import { atom, useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useMemoEqual } from "./memo-equal.js";

/**
 * Context type for managing namespaced state
 */
type NamespaceContextType = {
  namespace: string[];
  namespaceAtom: ReturnType<
    typeof atomWithStorage<Record<string, unknown>>
  > | null;
};

/**
 * Context for managing state namespaces
 * Provides access to the current namespace path and storage atom
 */
export const NamespaceContext = createContext<NamespaceContextType>({
  namespace: [],
  namespaceAtom: null,
});

/**
 * Provider component for managing namespaced state
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child components
 * @param {string} [props.namespace] - Optional namespace identifier
 * @param {ReturnType<typeof atomWithStorage<Record<string, unknown>>>} [props.rootAtom] - Optional root storage atom
 */
export function StateNamespaceProvider({
  children,
  namespace,
  rootAtom,
}: {
  children: ReactNode;
  namespace?: string;
  rootAtom?: ReturnType<typeof atomWithStorage<Record<string, unknown>>>;
}) {
  const parentContext = useContext(NamespaceContext);
  const newNamespace = namespace
    ? [...parentContext.namespace, namespace]
    : parentContext.namespace;

  // Memoize the check for root namespace to avoid unnecessary recalculations
  const isRootNamespace = useMemo(
    () => !parentContext.namespace.length,
    [parentContext.namespace.length],
  );

  const namespaceAtom = useMemo(() => {
    if (isRootNamespace && rootAtom) {
      return rootAtom;
    }
    return parentContext.namespaceAtom;
  }, [isRootNamespace, rootAtom, parentContext.namespaceAtom]);

  return (
    <NamespaceContext.Provider
      value={{ namespace: newNamespace, namespaceAtom }}
    >
      {children}
    </NamespaceContext.Provider>
  );
}

/**
 * Type representing a state namespace path
 */
export type StateNamespace = { path: string[] };

/**
 * Hook to create a namespace path by combining current context with additional path segments
 * @param {string[]} additionalPath - Additional path segments to append
 * @returns {StateNamespace} Combined namespace path
 */
export function useStateNamespace(additionalPath: string[]): StateNamespace {
  const { namespace } = useContext(NamespaceContext);
  const memoNamespace = useMemoEqual(namespace, compareStringArrays);
  const memoAdditionalPath = useMemoEqual(additionalPath, compareStringArrays);
  return useMemo(
    () => ({ path: [...memoNamespace, ...memoAdditionalPath] }),
    [memoNamespace, memoAdditionalPath],
  );
}

function createNamespacedAtom<T>(
  storageAtom: ReturnType<typeof atomWithStorage<Record<string, unknown>>>,
  path: string[],
  key: string,
  defaultValue: T,
) {
  const baseAtom = atom(
    (get) => {
      let state = get(storageAtom);
      for (const segment of path) {
        state = (state[segment] as Record<string, unknown>) || {};
      }
      return (state[key] ?? defaultValue) as T;
    },
    (get, set, update: T | ((prev: T) => T)) => {
      const currentValue = get(baseAtom);
      const newValue =
        typeof update === "function"
          ? (update as (prev: T) => T)(currentValue)
          : update;

      set(storageAtom, (prevState) =>
        setDeepValue(prevState, path, key, newValue),
      );
    },
  );

  return baseAtom;
}

// compares two string arrays for equality.
function compareStringArrays(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function useParentStateNamespaceAtom() {
  const context = useContext(NamespaceContext);
  return useMemo(() => {
    if (context.namespaceAtom) {
      return context.namespaceAtom;
    }
    // Create a non-persisted atom if no storage atom is provided
    return atomWithStorage<Record<string, unknown>>(
      "temp-state",
      {},
      {
        getItem: () => ({}),
        setItem: () => {},
        removeItem: () => {},
      },
    );
  }, [context.namespaceAtom]);
}

export function useStateNamespaceAtom<T>(
  namespace: StateNamespace | null,
  key: string,
  defaultValue: T,
): [T, (update: T | ((prev: T) => T)) => void] {
  const context = useContext(NamespaceContext);

  // this useMemoEqual is necessary to avoid an infinite rerender loop.
  const path = useMemoEqual(
    namespace?.path || context.namespace,
    compareStringArrays,
  );

  const parentAtom = useParentStateNamespaceAtom();

  const stableAtom = useMemo(
    () => createNamespacedAtom(parentAtom, path, key, defaultValue),
    [parentAtom, path, key, defaultValue],
  );

  return useAtom(stableAtom);
}

/**
 * Component for debugging namespace state
 * Displays the current state for the active namespace
 */
// Helper function to set deeply nested value
function setDeepValue(
  obj: Record<string, unknown>,
  keys: string[],
  key: string,
  value: unknown,
): Record<string, unknown> {
  if (keys.length === 0) {
    return { ...obj, [key]: value };
  }
  const [first, ...rest] = keys;
  return {
    ...obj,
    [first]: setDeepValue(
      (obj[first] as Record<string, unknown>) || {},
      rest,
      key,
      value,
    ),
  };
}

function createNamespacedReducerAtom<State, Action>(
  storageAtom: ReturnType<typeof atomWithStorage<Record<string, unknown>>>,
  path: string[],
  key: string,
  reducer: (state: State, action: Action) => State,
  initialState: State,
) {
  const baseAtom = atom(
    (get) => {
      let state = get(storageAtom);
      for (const segment of path) {
        state = (state[segment] as Record<string, unknown>) || {};
      }
      return (state[key] ?? initialState) as State;
    },
    (get, set, action: Action) => {
      const currentState = get(baseAtom);
      const newState = reducer(currentState, action);

      set(storageAtom, (prevState) =>
        setDeepValue(prevState, path, key, newState),
      );
    },
  );

  return baseAtom;
}

export function useStateNamespaceReducerAtom<State, Action>(
  namespace: StateNamespace | null,
  key: string,
  reducer: (state: State, action: Action) => State,
  initialState: State,
): [State, (action: Action) => void] {
  const context = useContext(NamespaceContext);
  const path = useMemoEqual(
    namespace?.path || context.namespace,
    compareStringArrays,
  );
  const parentAtom = useParentStateNamespaceAtom();

  const stableAtom = useMemo(
    () =>
      createNamespacedReducerAtom(parentAtom, path, key, reducer, initialState),
    [parentAtom, path, key, reducer, initialState],
  );

  return useAtom(stableAtom);
}

export function StateDebugger() {
  const { namespace } = useContext(NamespaceContext);
  const fullState = useAtomValue(useParentStateNamespaceAtom());

  // Get the state for the current namespace level
  const getCurrentState = (
    state: Record<string, unknown>,
    path: string[],
  ): Record<string, unknown> => {
    let current = state;
    for (const segment of path) {
      current = (current[segment] as Record<string, unknown>) || {};
    }
    return current;
  };

  const currentState = getCurrentState(fullState, namespace);
  return <pre>{JSON.stringify(currentState, null, 2)}</pre>;
}
