import type { ReactNode } from "react";
import { Routes, Route } from "react-router-dom";
import { Landing } from "./pages/Landing";

function Placeholder({ name }: { name: string }): ReactNode {
  return <div style={{ padding: "2rem" }}><h1>{name}</h1><p>Coming soon...</p></div>;
}

export function App(): ReactNode {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<Placeholder name="Dashboard" />} />
    </Routes>
  );
}
