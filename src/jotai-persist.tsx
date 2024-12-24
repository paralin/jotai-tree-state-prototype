import React from "react";
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

export interface StateNamespace {
  path: string[];
}

export function useStateNamespace(additionalPath: string[]): StateNamespace {
  const { namespace } = useContext(NamespaceContext);
  return useMemo(
    () => ({ path: [...namespace, ...additionalPath] }),
    [namespace, additionalPath]
  );
}


export function useStateNamespaceAtom<T>(
  namespace: StateNamespace,
  key: string,
  defaultValue: T
) {
  const path = useMemo(() => [...namespace.path, key], [namespace.path, key]);
  const derivedAtom = useMemo(
    () => atom(
      (get) => {
        const value = getNestedValue(get(rootAtom), path);
        return (value ?? defaultValue) as T;
      },
      (get, set, update: T | ((prev: T) => T)) => {
        const currentValue = get(rootAtom);
        const newValue = typeof update === "function"
          ? (update as (prev: T) => T)(getNestedValue(currentValue, path) as T ?? defaultValue)
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
      }
    ),
    [JSON.stringify(path), defaultValue]
  );
  return useAtom(derivedAtom);
}

export function usePersistedAtom<T>(key: string, defaultValue: T) {
  const namespace = useStateNamespace([]);
  return useStateNamespaceAtom(namespace, key, defaultValue);
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
