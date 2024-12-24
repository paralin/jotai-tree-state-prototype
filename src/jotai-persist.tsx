import { atom, useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

/**
 * Context type for managing namespaced state
 */
type NamespaceContextType = {
  namespace: string[];
  namespaceAtom: ReturnType<typeof atomWithStorage<Record<string, unknown>>>;
};

/**
 * Context for managing state namespaces
 * Provides access to the current namespace path and storage atom
 */
export const NamespaceContext = createContext<NamespaceContextType>({
  namespace: [],
  namespaceAtom: atomWithStorage<Record<string, unknown>>("root", {}),
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
  return { path: [...namespace, ...additionalPath] };
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

/**
 * Memoizes a value using custom equality comparison.
 * Returns the memoized value if the new value is considered equal.
 *
 * @template T - The value type
 * @param value - The value to potentially memoize
 * @param checkEqual - Optional function to compare values for equality
 * @returns The memoized value if equal, otherwise the new value
 */
function useMemoEqual<T>(
  value: T,
  checkEqual?: (v1: NonNullable<T>, v2: NonNullable<T>) => boolean,
): T {
  const ref = useRef<T>(value);

  const isEqual =
    value === ref.current ||
    (value != null &&
      ref.current != null &&
      checkEqual &&
      checkEqual(value as NonNullable<T>, ref.current as NonNullable<T>));

  if (!isEqual) {
    ref.current = value;
  }

  return ref.current;
}

// compares two string arrays for equality.
function compareStringArrays(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
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

  const stableAtom = useMemo(
    () => createNamespacedAtom(context.namespaceAtom, path, key, defaultValue),
    [context.namespaceAtom, path, key, defaultValue],
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

export function StateDebugger() {
  const { namespace, namespaceAtom } = useContext(NamespaceContext);
  const fullState = useAtomValue(namespaceAtom);

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
