import { Link } from "react-router-dom";
import { legalPages } from "../data/legal";
import { Brand } from "./Header";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Brand to="/" />
          <p>Ebooks and audiobooks for everyone at home.</p>
        </div>
        <nav aria-label="Policies and help">
          <ul className="footer-links">
            {legalPages.map((p) => (
              <li key={p.slug}>
                <Link to={`/legal/${p.slug}`}>{p.title}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <p className="footer-note">
        BookWorm is a demo. Data stays in this browser tab and resets when you refresh. Book details are sample data.
      </p>
    </footer>
  );
}
