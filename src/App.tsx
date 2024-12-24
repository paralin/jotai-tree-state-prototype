import React from "react";
import {
  StateNamespaceProvider,
  useStateNamespace,
  useStateNamespaceAtom,
  StateDebugger,
} from "./jotai-persist";

// Counter component with persisted state
interface CounterProps {
  className?: string;
}

function Counter({ className }: CounterProps) {
  const [count, setCount] = useStateNamespaceAtom(null, "count", 0);

  return (
    <button
      onClick={() => setCount((c) => c + 1)}
      style={{
        padding: "8px 16px",
        backgroundColor: "#3b82f6",
        color: "white",
        borderRadius: "4px",
        cursor: "pointer",
        ...(className && typeof className === "object" ? className : {}),
      }}
    >
      Count: {count}
    </button>
  );
}

// Container component for consistent styling
interface ContainerProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

function Container({ title, children, className }: ContainerProps) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "4px",
        padding: "16px",
        ...(className && typeof className === "object" ? className : {}),
      }}
    >
      <h3 style={{ fontWeight: "bold", marginBottom: "16px" }}>{title}</h3>
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
      <div
        style={{
          flex: 1,
          border: "1px solid #e5e7eb",
          borderRadius: "4px",
          padding: "16px",
        }}
      >
        <h5 style={{ fontWeight: "bold", marginBottom: "8px" }}>{title}</h5>
        {children}
      </div>
    </StateNamespaceProvider>
  );
}

// Main content area
function Content() {
  return (
    <StateNamespaceProvider namespace="main">
      <Container title="Main Content" className="ml-4 mt-4">
        <div style={{ marginBottom: "16px" }}>
          <Counter />
          <StateDebugger />
        </div>

        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: "16px",
          }}
        >
          <Region title="Primary Region" namespace="primary">
            <Counter />
            <StateDebugger />
          </Region>

          <Region title="Secondary Region" namespace="secondary">
            <Counter />
            <StateDebugger />

            <div
              style={{
                borderTop: "1px solid #e5e7eb",
                paddingTop: "16px",
                marginTop: "16px",
              }}
            >
              <StateNamespaceProvider namespace="nested">
                <h6 style={{ fontWeight: "bold", marginBottom: "8px" }}>
                  Nested Content
                </h6>
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
      onClick={() => setCount((c) => c + 1)}
      style={{
        padding: "8px 16px",
        backgroundColor: "#3b82f6",
        color: "white",
        borderRadius: "4px",
        cursor: "pointer",
      }}
    >
      Namespaced Count: {count}
    </button>
  );
}

function App() {
  return (
    <StateNamespaceProvider>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "32px",
          padding: "16px",
        }}
      >
        <Container title="Root">
          <Counter className="mb-4" />
          <StateDebugger />
        </Container>
        <Content />
        <Container title="Custom Namespace Example">
          <NamespacedCounter />
          <StateDebugger />
        </Container>
      </div>
    </StateNamespaceProvider>
  );
}

export default App;
