import type { ReactNode } from "react";

export function Footer(): ReactNode {
  return (
    <footer>
      <span className="footer-l">Dossier &middot; OWS Hackathon 2026</span>
      <div className="footer-links">
        <a href="https://github.com/checkra1neth/dossier" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="#commands">API</a>
        <a href="https://xmtp.org" target="_blank" rel="noopener noreferrer">XMTP</a>
      </div>
    </footer>
  );
}
