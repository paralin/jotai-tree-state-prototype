import { useContext } from "react";
import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { atomWithStorage } from "jotai/utils";
import {
  StateNamespaceProvider,
  useStateNamespaceAtom,
  NamespaceContext,
  useStateNamespace,
} from "./jotai-persist";

// Test component that uses the namespace state
function TestCounter({ namespace }: { namespace?: string }) {
  return (
    <StateNamespaceProvider namespace={namespace}>
      <CounterContent />
    </StateNamespaceProvider>
  );
}

function CounterContent() {
  const [count, setCount] = useStateNamespaceAtom(null, "count", 0);
  const { namespace: contextNamespace } = useContext(NamespaceContext);
  const testId =
    contextNamespace.length > 0
      ? `counter-${contextNamespace.join("-")}`
      : "counter-root";
  return (
    <button onClick={() => setCount((c: number) => c + 1)} data-testid={testId}>
      Count: {count}
    </button>
  );
}

describe("StateNamespaceProvider", () => {
  it("maintains isolated state for different namespaces", () => {
    const rootAtom = atomWithStorage<Record<string, unknown>>(
      "test-storage",
      {},
    );

    render(
      <StateNamespaceProvider rootAtom={rootAtom} namespace="test1">
        <TestCounter />
        <TestCounter namespace="namespace1" />
        <TestCounter namespace="namespace2" />
      </StateNamespaceProvider>,
    );

    const rootButton = screen.getByTestId("counter-test1");
    const ns1Button = screen.getByTestId("counter-test1-namespace1");
    const ns2Button = screen.getByTestId("counter-test1-namespace2");

    // Click root counter
    fireEvent.click(rootButton);
    expect(rootButton.textContent).toBe("Count: 1");
    expect(ns1Button.textContent).toBe("Count: 0");
    expect(ns2Button.textContent).toBe("Count: 0");

    // Click namespace1 counter
    fireEvent.click(ns1Button);
    expect(rootButton.textContent).toBe("Count: 1");
    expect(ns1Button.textContent).toBe("Count: 1");
    expect(ns2Button.textContent).toBe("Count: 0");

    // Click namespace2 counter
    fireEvent.click(ns2Button);
    expect(rootButton.textContent).toBe("Count: 1");
    expect(ns1Button.textContent).toBe("Count: 1");
    expect(ns2Button.textContent).toBe("Count: 1");
  });

  it("handles nested namespaces correctly", () => {
    const rootAtom = atomWithStorage<Record<string, unknown>>(
      "test-nested",
      {},
    );

    render(
      <StateNamespaceProvider rootAtom={rootAtom} namespace="test2">
        <TestCounter />
        <StateNamespaceProvider namespace="parent">
          <TestCounter />
          <StateNamespaceProvider namespace="child">
            <TestCounter />
          </StateNamespaceProvider>
        </StateNamespaceProvider>
      </StateNamespaceProvider>,
    );

    const rootButton = screen.getByTestId("counter-test2");
    const parentButton = screen.getByTestId("counter-test2-parent");
    const childButton = screen.getByTestId("counter-test2-parent-child");

    // Click nested counters
    fireEvent.click(rootButton);
    fireEvent.click(parentButton);
    fireEvent.click(childButton);

    expect(rootButton.textContent).toBe("Count: 1");
    expect(parentButton.textContent).toBe("Count: 1");
    expect(childButton.textContent).toBe("Count: 1");
  });

  it("preserves state updates within namespaces", () => {
    const rootAtom = atomWithStorage<Record<string, unknown>>(
      "test-persist",
      {},
    );

    const { rerender } = render(
      <StateNamespaceProvider rootAtom={rootAtom}>
        <TestCounter namespace="test" />
      </StateNamespaceProvider>,
    );

    const button = screen.getByTestId("counter-test");
    fireEvent.click(button);
    expect(button.textContent).toBe("Count: 1");

    // Rerender and verify state persistence
    rerender(
      <StateNamespaceProvider rootAtom={rootAtom}>
        <TestCounter namespace="test" />
      </StateNamespaceProvider>,
    );

    expect(screen.getByTestId("counter-test").textContent).toBe("Count: 1");
  });

  it("handles custom namespace paths correctly", () => {
    const rootAtom = atomWithStorage<Record<string, unknown>>(
      "test-custom",
      {},
    );

    function CustomNamespacedCounter() {
      const namespace = useStateNamespace(["custom", "path"]);
      const [count, setCount] = useStateNamespaceAtom(namespace, "count", 0);
      return (
        <button
          onClick={() => setCount((c: number) => c + 1)}
          data-testid="custom-counter"
        >
          Count: {count}
        </button>
      );
    }

    render(
      <StateNamespaceProvider rootAtom={rootAtom}>
        <CustomNamespacedCounter />
      </StateNamespaceProvider>,
    );

    const button = screen.getByTestId("custom-counter");
    fireEvent.click(button);
    expect(button.textContent).toBe("Count: 1");
  });
});
