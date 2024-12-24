import React from "react";
import { atomWithStorage } from "jotai/utils";
import {
  StateNamespaceProvider,
  useStateNamespace,
  useStateNamespaceAtom,
  StateDebugger,
} from "./jotai-persist";

import "./App.css";

// Reset button to clear persisted state
function ResetButton() {
  return (
    <button
      onClick={() => {
        localStorage.clear();
        window.location.reload();
      }}
      className="reset-button"
    >
      Reset All State
    </button>
  );
}

// Create a persisted root atom for the entire app
const persistedRootAtom = atomWithStorage<Record<string, unknown>>(
  "app-state",
  {},
);

// Counter component with persisted state
function Counter() {
  const [count, setCount] = useStateNamespaceAtom(null, "count", 0);

  return (
    <button
      onClick={() => setCount((c: number) => c + 1)}
      className="counter-button"
    >
      Count: {count}
    </button>
  );
}

// Container component for consistent styling
interface ContainerProps {
  title: string;
  children: React.ReactNode;
}

function Container({ title, children }: ContainerProps) {
  return (
    <div className="container">
      <h3 className="container-title">{title}</h3>
      {children}
    </div>
  );
}

// Region component for namespaced sections
interface RegionProps {
  title: string;
  namespace: string;
  children?: React.ReactNode;
}

function Region({ title, namespace, children }: RegionProps) {
  return (
    <StateNamespaceProvider namespace={namespace}>
      <div className="region">
        <h5 className="region-title">{title}</h5>
        {children}
      </div>
    </StateNamespaceProvider>
  );
}

// Main content area
function Content() {
  return (
    <StateNamespaceProvider namespace="main">
      <Container title="Main Content">
        <div className="counter-margin">
          <Counter />
          <StateDebugger />
        </div>

        <div className="region-container">
          <Region title="Primary Region" namespace="primary">
            <Counter />
            <StateDebugger />
          </Region>

          <Region title="Secondary Region" namespace="secondary">
            <Counter />
            <StateDebugger />

            <div className="nested-content">
              <StateNamespaceProvider namespace="nested">
                <h6 className="nested-title">Nested Content</h6>
                <Counter />
                <StateDebugger />
              </StateNamespaceProvider>
            </div>
          </Region>
        </div>
      </Container>
    </StateNamespaceProvider>
  );
}

// Example of using the new namespace hooks
function NamespacedCounter() {
  const namespace = useStateNamespace(["custom", "path"]);
  const [count, setCount] = useStateNamespaceAtom(namespace, "count", 0);

  return (
    <button
      onClick={() => setCount((c: number) => c + 1)}
      className="counter-button"
    >
      Namespaced Count: {count}
    </button>
  );
}

function App() {
  return (
    <StateNamespaceProvider rootAtom={persistedRootAtom}>
      <div className="app-wrapper">
        <div className="demo-description">
          <h2>Jotai Persistence Demo</h2>
          <p>
            This demo showcases a nested state management system using Jotai
            with persistence.
          </p>
          <ul>
            <li>Persistent state across page reloads using localStorage</li>
            <li>Nested state namespaces (main, primary, secondary, nested)</li>
            <li>Independent counters in different namespaces</li>
            <li>State debugging display for each namespace</li>
            <li>Custom namespace paths</li>
          </ul>
          <p>
            Each counter maintains its own state within its namespace, and all
            state is automatically persisted to localStorage under the
            "app-state" key.
          </p>
        </div>
        <div className="reset-button-container">
          <ResetButton />
        </div>
      </div>
      <div className="main-content">
        <Container title="Root">
          <Counter />
          <StateDebugger />
        </Container>
        <Content />
        <Container title="Custom Namespace Example">
          <NamespacedCounter />
        </Container>
      </div>
    </StateNamespaceProvider>
  );
}

export default App;
