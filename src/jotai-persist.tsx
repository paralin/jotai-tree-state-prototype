import { atom, useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { createContext, useContext, useMemo, ReactNode } from "react";

const rootAtom = atomWithStorage<Record<string, unknown>>("app-state", {});

interface NamespaceContextType {
  namespace: string[];
}

const NamespaceContext = createContext<NamespaceContextType>({ namespace: [] });

interface NamespaceProviderProps {
  children: ReactNode;
  namespace?: string;
}

export function StateNamespaceProvider({
  children,
  namespace,
}: NamespaceProviderProps) {
  const parentContext = useContext(NamespaceContext);
  const value = {
    namespace: namespace
      ? [...parentContext.namespace, namespace]
      : parentContext.namespace,
  };

  return (
    <NamespaceContext.Provider value={value}>
      {children}
    </NamespaceContext.Provider>
  );
}

function getNestedValue(obj: Record<string, unknown>, path: string[]) {
  let current = obj;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = current[key] as Record<string, unknown>;
  }
  return current;
}

export function usePersistedAtom<T>(key: string, defaultValue: T) {
  const { namespace } = useContext(NamespaceContext);
  
  const path = useMemo(() => [...namespace, key], [namespace, key]);
  
  const derivedAtom = useMemo(
    () =>
      atom(
        (get) => {
          const value = getNestedValue(get(rootAtom), path);
          return (value ?? defaultValue) as T;
        },
        (get, set, update: T | ((prev: T) => T)) => {
          const newValue =
            typeof update === "function"
              ? (update as (prev: T) => T)(get(derivedAtom))
              : update;

          set(rootAtom, (state) => {
            const result = { ...state };
            let current = result;

            for (let i = 0; i < path.length - 1; i++) {
              const key = path[i];
              current[key] = { ...((current[key] as Record<string, unknown>) || {}) };
              current = current[key] as Record<string, unknown>;
            }

            current[path[path.length - 1]] = newValue;
            return result;
          });
        },
      ),
    [path, defaultValue],
  );

  return useAtom(derivedAtom);
}

export function StateDebugger() {
  const { namespace } = useContext(NamespaceContext);
  
  const scopedAtom = useMemo(
    () =>
      atom((get) => {
        if (namespace.length === 0) return get(rootAtom);
        return getNestedValue(get(rootAtom), namespace) ?? {};
      }),
    [namespace],
  );

  const state = useAtomValue(scopedAtom);
  return <pre>{JSON.stringify(state, null, 2)}</pre>;
}
