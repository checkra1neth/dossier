import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function Nav(): ReactNode {
  return (
    <nav className="nav">
      <a href="#" className="nav-logo">Intelligence Wire</a>
      <div className="nav-r">
        <a href="#commands">Commands</a>
        <a href="#pipeline">Pipeline</a>
        <a href="#pricing">Pricing</a>
        <Link to="/app" className="pill">Launch app</Link>
      </div>
    </nav>
  );
}
