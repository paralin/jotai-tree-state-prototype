import { atom, useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { createContext, useContext, useMemo, type ReactNode } from "react";

type NamespaceContextType = {
  namespace: string[];
  namespaceAtom: ReturnType<typeof atomWithStorage<Record<string, unknown>>>;
};

export const NamespaceContext = createContext<NamespaceContextType>({
  namespace: [],
  namespaceAtom: atomWithStorage<Record<string, unknown>>("root", {}),
});

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

export type StateNamespace = { path: string[] };

export function useStateNamespace(additionalPath: string[]): StateNamespace {
  const { namespace } = useContext(NamespaceContext);
  return { path: [...namespace, ...additionalPath] };
}

export function useStateNamespaceAtom<T>(
  namespace: StateNamespace | null,
  key: string,
  defaultValue: T,
) {
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
            function setDeepValue(obj: Record<string, unknown>, keys: string[], value: unknown): Record<string, unknown> {
              if (keys.length === 0) {
                return { ...obj, [key]: value };
              }
              const [first, ...rest] = keys;
              return {
                ...obj,
                [first]: setDeepValue(
                  (obj[first] as Record<string, unknown>) || {},
                  rest,
                  value
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

export function StateDebugger() {
  const { namespace, namespaceAtom } = useContext(NamespaceContext);
  const fullState = useAtomValue(namespaceAtom);

  // Get the state for the current namespace level
  const getCurrentState = (state: Record<string, unknown>, path: string[]): Record<string, unknown> => {
    let current = state;
    for (const segment of path) {
      current = (current[segment] as Record<string, unknown>) || {};
    }
    return current;
  };

  const currentState = getCurrentState(fullState, namespace);
  return <pre>{JSON.stringify(currentState, null, 2)}</pre>;
}
