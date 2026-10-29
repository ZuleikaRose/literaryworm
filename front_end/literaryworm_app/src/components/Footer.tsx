import { Link } from "react-router-dom";
import { openConsentPreferences } from "../lib/consent";
import { useLegalPages } from "../lib/useLegalPages";
import { Brand } from "./Header";

export function Footer() {
  const legalPages = useLegalPages();
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
            <li>
              <a
                href="#"
                className="termly-display-preferences"
                onClick={(e) => {
                  e.preventDefault();
                  openConsentPreferences();
                }}
              >
                Consent Preferences
              </a>
            </li>
            {/* Termly's request forms for the Privacy Policy. */}
            <li>
              <a href="https://app.termly.io/notify/871fc8a4-8e3f-473b-95eb-6dc83ebcd4da">
                Do Not Sell or Share My Personal information
              </a>
            </li>
            <li>
              <a href="https://app.termly.io/notify/871fc8a4-8e3f-473b-95eb-6dc83ebcd4da">
                Limit the Use Of My Sensitive Personal Information
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <p className="footer-note">
        LiteraryWorm is a demonstration app. Accounts, libraries, logs and reading progress are saved with Supabase; the demo household stays in this browser tab and resets when you refresh. LiteraryWorm titles are sample data; other book details come from Google Books.
      </p>
    </footer>
  );
}
