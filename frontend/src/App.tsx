import { Routes, Route } from "react-router-dom";

function Placeholder({ name }: { name: string }): JSX.Element {
  return <div style={{ padding: "2rem" }}><h1>{name}</h1><p>Coming soon...</p></div>;
}

export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Placeholder name="Landing" />} />
      <Route path="/app" element={<Placeholder name="Dashboard" />} />
    </Routes>
  );
}
