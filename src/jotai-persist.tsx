import {
  SetStateAction,
  WritableAtom,
  atom,
  useAtom,
  useAtomValue,
} from "jotai";
import { atomWithStorage } from "jotai/utils";
import { createContext, useContext, useMemo, ReactNode } from "react";

/**
 * Type definition for the namespace context value
 * Contains the namespace path array and an atom for the namespace's state
 */
interface NamespaceContextType {
  namespace: string[];
  namespaceAtom: WritableAtom<
    Record<string, unknown>,
    [SetStateAction<Record<string, unknown>>],
    void
  >;
}

/**
 * Context for managing nested state namespaces
 * Initialized with an empty namespace array and a default empty atom
 */
const NamespaceContext = createContext<NamespaceContextType>({
  namespace: [],
  namespaceAtom: atom<Record<string, unknown>>({}),
});

/**
 * Props for the StateNamespaceProvider component
 */
interface NamespaceProviderProps {
  children: ReactNode;
  namespace?: string;
  rootAtom?: ReturnType<typeof atomWithStorage<Record<string, unknown>>>;
}

/**
 * Provider component that manages nested state namespaces
 * Creates a derived atom for the current namespace that reads/writes to parent state
 *
 * @param props - The component props
 * @param props.children - Child components that will have access to this namespace
 * @param props.namespace - Optional namespace string to append to parent namespace
 * @param props.rootAtom - Optional root atom for state storage (only used at root level)
 */
export function StateNamespaceProvider({
  children,
  namespace,
  rootAtom,
}: NamespaceProviderProps) {
  const parentContext = useContext(NamespaceContext);
  const newNamespace = namespace
    ? [...parentContext.namespace, namespace]
    : parentContext.namespace;

  const namespaceAtom = useMemo(() => {
    // If we're at the root and have a rootAtom, create a derived atom from it
    if (!parentContext.namespace.length && rootAtom) {
      return atom(
        (get) => get(rootAtom),
        (get, set, update: SetStateAction<Record<string, unknown>>) => {
          const newValue =
            typeof update === "function" ? update(get(rootAtom)) : update;
          set(rootAtom, newValue);
        },
      );
    }

    // Otherwise create a derived atom that reads/writes to the parent namespace
    return atom(
      (get) => {
        const parentState = get(parentContext.namespaceAtom);
        return namespace
          ? ((getNestedValue(parentState, [namespace]) as Record<
              string,
              unknown
            >) ?? {})
          : parentState;
      },
      (_get, set, update: SetStateAction<Record<string, unknown>>) => {
        set(parentContext.namespaceAtom, (prev) => {
          const newValue =
            typeof update === "function"
              ? update(
                  namespace
                    ? ((getNestedValue(prev, [namespace]) as Record<
                        string,
                        unknown
                      >) ?? {})
                    : prev,
                )
              : update;

          if (!namespace) return newValue;
          return {
            ...prev,
            [namespace]: newValue,
          };
        });
      },
    );
  }, [namespace, parentContext.namespaceAtom, rootAtom]);

  const value = {
    namespace: newNamespace,
    namespaceAtom,
  };

  return (
    <NamespaceContext.Provider value={value}>
      {children}
    </NamespaceContext.Provider>
  );
}

/**
 * Helper function to safely access nested object properties using a path array
 *
 * @param obj - The object to traverse
 * @param path - Array of string keys representing the path to the desired value
 * @returns The value at the specified path or undefined if the path is invalid
 */
function getNestedValue(obj: Record<string, unknown>, path: string[]) {
  let current = obj;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = current[key] as Record<string, unknown>;
  }
  return current;
}

/**
 * Interface representing a state namespace
 * Contains a path array of strings that define the namespace location
 */
export interface StateNamespace {
  path: string[];
}

/**
 * Hook to create a namespace object by combining the current context namespace
 * with additional path segments
 *
 * @param additionalPath - Array of strings to append to the current namespace
 * @returns A StateNamespace object containing the combined path
 */
export function useStateNamespace(additionalPath: string[]): StateNamespace {
  const { namespace } = useContext(NamespaceContext);
  return useMemo(
    () => ({ path: [...namespace, ...additionalPath] }),
    [namespace, additionalPath],
  );
}

/**
 * Hook to create an atom for storing state within a specific namespace
 * Handles reading and writing nested state while maintaining immutability
 *
 * @param namespace - Optional StateNamespace object to override context namespace
 * @param key - The key for this piece of state within the namespace
 * @param defaultValue - Default value to use when no value exists
 * @returns A tuple containing the current value and a setter function
 */
export function useStateNamespaceAtom<T>(
  namespace: StateNamespace | null,
  key: string,
  defaultValue: T,
) {
  const context = useContext(NamespaceContext);
  const effectivePath = useMemo(
    () => [...(namespace?.path ?? context.namespace), key],
    [namespace?.path, context.namespace, key],
  );
  const { namespaceAtom } = useContext(NamespaceContext);

  const derivedAtom = useMemo(
    () =>
      atom(
        // Read function
        (get) => {
          const state = get(namespaceAtom);
          let current = state;

          // Navigate to the correct namespace
          for (let i = 0; i < effectivePath.length - 1; i++) {
            current =
              (current[effectivePath[i]] as Record<string, unknown>) ?? {};
          }

          return (current[key] ?? defaultValue) as T;
        },
        // Write function
        (_get, set, update: T | ((prev: T) => T)) => {
          set(namespaceAtom, (state) => {
            // Navigate to get the current value
            let current = state;
            const pathToValue = effectivePath.slice(0, -1);

            for (const segment of pathToValue) {
              current = (current[segment] as Record<string, unknown>) ?? {};
            }

            const currentValue = (current[key] ?? defaultValue) as T;
            const newValue =
              typeof update === "function"
                ? (update as (prev: T) => T)(currentValue)
                : update;

            // Create new state with updated value
            const result = { ...state };
            let currentObj = result;

            // Build path to value, creating objects as needed
            for (let i = 0; i < pathToValue.length; i++) {
              const segment = pathToValue[i];
              currentObj[segment] = {
                ...((currentObj[segment] as Record<string, unknown>) ?? {}),
              };
              currentObj = currentObj[segment] as Record<string, unknown>;
            }

            // Set the final value
            currentObj[key] = newValue;
            return result;
          });
        },
      ),
    [key, defaultValue],
  );
  return useAtom(derivedAtom);
}

/**
 * Debug component that displays the current state for a namespace
 * Shows the entire state tree if used at the root namespace
 *
 * @returns A pre element containing the formatted JSON state
 */
export function StateDebugger() {
  const { namespaceAtom } = useContext(NamespaceContext);
  const state = useAtomValue(namespaceAtom);
  return <pre>{JSON.stringify(state, null, 2)}</pre>;
}
