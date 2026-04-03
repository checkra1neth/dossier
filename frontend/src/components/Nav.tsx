import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function Nav(): ReactNode {
  return (
    <nav className="nav">
      <a href="#" className="nav-logo">Dossier</a>
      <div className="nav-r">
        <a href="#commands">Commands</a>
        <a href="#how">How it works</a>
        <Link to="/app" className="pill">Launch app</Link>
      </div>
    </nav>
  );
}
