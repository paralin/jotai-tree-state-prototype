import { useRef } from "react";

/**
 * Memoizes a value using custom equality comparison.
 * Returns the memoized value if the new value is considered equal.
 *
 * @template T - The value type
 * @param value - The value to potentially memoize
 * @param checkEqual - Optional function to compare values for equality
 * @returns The memoized value if equal, otherwise the new value
 */
export function useMemoEqual<T>(
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
