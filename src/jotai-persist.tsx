import { atom, useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { createContext, useContext, useMemo, type ReactNode } from "react";

/**
 * Context type for managing namespaced state
 * @typedef {Object} NamespaceContextType
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

  const namespaceAtom = useMemo(() => {
    if (!parentContext.namespace.length && rootAtom) {
      return rootAtom;
    }

    return parentContext.namespaceAtom;
  }, [namespace, parentContext.namespaceAtom, rootAtom, ...newNamespace]);

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

/**
 * Hook to access and modify state within a namespace
 * @template T - Type of the stored value
 * @param {StateNamespace | null} namespace - Optional custom namespace
 * @param {string} key - State key within the namespace
 * @param {T} defaultValue - Default value if state is not initialized
 * @returns {[T, (update: T | ((prev: T) => T)) => void]} Tuple of state value and setter
 */
export function useStateNamespaceAtom<T>(
  namespace: StateNamespace | null,
  key: string,
  defaultValue: T,
): [T, (update: T | ((prev: T) => T)) => void] {
  const context = useContext(NamespaceContext);
  const path = namespace?.path || context.namespace;

  const derivedAtom = useMemo(
    () =>
      atom(
        (get) => {
          let state = get(context.namespaceAtom);
          // Traverse the namespace path
          for (const segment of path) {
            state = (state[segment] as Record<string, unknown>) || {};
          }
          return (state[key] ?? defaultValue) as T;
        },
        (get, set, update) => {
          set(context.namespaceAtom, (prevState) => {
            const newValue =
              typeof update === "function" ? update(get(derivedAtom)) : update;

            // Helper function to set deeply nested value
            function setDeepValue(
              obj: Record<string, unknown>,
              keys: string[],
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
                  value,
                ),
              };
            }

            return setDeepValue(prevState, path, newValue);
          });
        },
      ),
    [key, defaultValue, context.namespaceAtom, ...path],
  );

  return useAtom(derivedAtom);
}

/**
 * Component for debugging namespace state
 * Displays the current state for the active namespace
 */
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
