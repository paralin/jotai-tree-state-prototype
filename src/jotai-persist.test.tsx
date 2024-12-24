import { useContext } from "react";
import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { atomWithStorage } from "jotai/utils";
import {
  StateNamespaceProvider,
  useStateNamespaceAtom,
  NamespaceContext,
  useStateNamespace,
  useStateNamespaceReducerAtom,
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

  describe("StateNamespaceReducerAtom", () => {
    // Define a simple counter reducer for testing
    type CounterState = { value: number };
    type CounterAction = { type: "INCREMENT" } | { type: "DECREMENT" };

    const counterReducer = (
      state: CounterState,
      action: CounterAction,
    ): CounterState => {
      switch (action.type) {
        case "INCREMENT":
          return { value: state.value + 1 };
        case "DECREMENT":
          return { value: state.value - 1 };
        default:
          return state;
      }
    };

    const initialState: CounterState = { value: 0 };

    function ReducerCounter({ namespace }: { namespace?: string }) {
      return (
        <StateNamespaceProvider namespace={namespace}>
          <ReducerCounterContent />
        </StateNamespaceProvider>
      );
    }

    function ReducerCounterContent() {
      const [state, dispatch] = useStateNamespaceReducerAtom<
        CounterState,
        CounterAction
      >(null, "reducerCount", counterReducer, initialState);

      const { namespace: contextNamespace } = useContext(NamespaceContext);
      const testId =
        contextNamespace.length > 0
          ? `reducer-counter-${contextNamespace.join("-")}`
          : "reducer-counter-root";

      return (
        <div>
          <div data-testid={testId}>Count: {state.value}</div>
          <button
            onClick={() => dispatch({ type: "INCREMENT" })}
            data-testid={`${testId}-increment`}
          >
            Increment
          </button>
          <button
            onClick={() => dispatch({ type: "DECREMENT" })}
            data-testid={`${testId}-decrement`}
          >
            Decrement
          </button>
        </div>
      );
    }

    it("handles basic reducer state updates", () => {
      const rootAtom = atomWithStorage<Record<string, unknown>>(
        "test-reducer",
        {},
      );

      const { getByTestId } = render(
        <StateNamespaceProvider rootAtom={rootAtom}>
          <ReducerCounter />
        </StateNamespaceProvider>,
      );

      const increment = getByTestId("reducer-counter-root-increment");
      const decrement = getByTestId("reducer-counter-root-decrement");
      const display = getByTestId("reducer-counter-root");

      // Initial state
      expect(display.textContent).toBe("Count: 0");

      // Increment twice
      fireEvent.click(increment);
      expect(display.textContent).toBe("Count: 1");

      fireEvent.click(increment);
      expect(display.textContent).toBe("Count: 2");

      // Decrement once
      fireEvent.click(decrement);
      expect(display.textContent).toBe("Count: 1");
    });

    it("maintains isolated reducer state for different namespaces", () => {
      const rootAtom = atomWithStorage<Record<string, unknown>>(
        "test-reducer-namespaces",
        {},
      );

      render(
        <StateNamespaceProvider rootAtom={rootAtom} namespace="test">
          <ReducerCounter />
          <ReducerCounter namespace="ns1" />
          <ReducerCounter namespace="ns2" />
        </StateNamespaceProvider>,
      );

      const rootIncrement = screen.getByTestId(
        "reducer-counter-test-increment",
      );
      const ns1Increment = screen.getByTestId(
        "reducer-counter-test-ns1-increment",
      );

      const rootDisplay = screen.getByTestId("reducer-counter-test");
      const ns1Display = screen.getByTestId("reducer-counter-test-ns1");
      const ns2Display = screen.getByTestId("reducer-counter-test-ns2");

      fireEvent.click(rootIncrement);
      expect(rootDisplay.textContent).toBe("Count: 1");
      expect(ns1Display.textContent).toBe("Count: 0");
      expect(ns2Display.textContent).toBe("Count: 0");

      fireEvent.click(ns1Increment);
      expect(rootDisplay.textContent).toBe("Count: 1");
      expect(ns1Display.textContent).toBe("Count: 1");
      expect(ns2Display.textContent).toBe("Count: 0");
    });

    it("persists reducer state across rerenders", () => {
      const rootAtom = atomWithStorage<Record<string, unknown>>(
        "test-reducer-persist",
        {},
      );

      const { rerender } = render(
        <StateNamespaceProvider rootAtom={rootAtom}>
          <ReducerCounter namespace="persist" />
        </StateNamespaceProvider>,
      );

      const increment = screen.getByTestId("reducer-counter-persist-increment");
      const display = screen.getByTestId("reducer-counter-persist");

      fireEvent.click(increment);
      expect(display.textContent).toBe("Count: 1");

      rerender(
        <StateNamespaceProvider rootAtom={rootAtom}>
          <ReducerCounter namespace="persist" />
        </StateNamespaceProvider>,
      );

      expect(screen.getByTestId("reducer-counter-persist").textContent).toBe(
        "Count: 1",
      );
    });
  });
});
