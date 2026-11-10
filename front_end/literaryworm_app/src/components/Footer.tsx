import { Link } from "react-router-dom";
import { openConsentPreferences } from "../lib/consent";
import { tk } from "../lib/i18n";
import { useLegalPages } from "../lib/useLegalPages";
import { useT } from "../lib/useT";
import { Brand } from "./Header";

/**
 * Which footer column each footer page goes in, by slug, in the order listed; a page added
 * later goes under Legal, after these.
 */
const PAGE_GROUP: Record<string, "help" | "privacy" | "legal"> = {
  help: "help",
  status: "help",
  accessibility: "help",
  privacy: "privacy",
  cookies: "privacy",
  "childrens-privacy": "privacy",
  "privacy-choices": "privacy",
};

const ORDER = Object.keys(PAGE_GROUP);
const rank = (slug: string) => (ORDER.includes(slug) ? ORDER.indexOf(slug) : ORDER.length);

/** The footer pages' titles, translated in the footer (the pages themselves stay in English). */
const LEGAL_TITLES = [
  tk("Accessibility Policy"),
  tk("Privacy Policy"),
  tk("Cookie Policy"),
  tk("Children's Privacy Notice"),
  tk("Your Privacy Choices"),
  tk("Terms of Service"),
  tk("End User License Agreement"),
  tk("Acceptable Use Policy"),
  tk("Return Policy"),
  tk("Copyright/DMCA"),
  tk("Disclaimer"),
  tk("Help"),
  tk("Status"),
];

void LEGAL_TITLES;

// Termly's request form for the Privacy Policy (Do Not Sell or Share; Limit the Use).
const TERMLY_REQUESTS = "https://app.termly.io/notify/871fc8a4-8e3f-473b-95eb-6dc83ebcd4da";

export function Footer() {
  const legalPages = useLegalPages();
  const t = useT();
  const pages = (group: "help" | "privacy" | "legal") =>
    legalPages
      .filter((p) => (PAGE_GROUP[p.slug] ?? "legal") === group)
      .sort((a, b) => rank(a.slug) - rank(b.slug))
      .map((p) => (
        <li key={p.slug}>
          <Link to={`/legal/${p.slug}`}>{t(p.title)}</Link>
        </li>
      ));

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Brand to="/" />
          <p>{t("Ebooks and audiobooks for everyone at home.")}</p>
        </div>
        <nav className="footer-nav" aria-label={t("Footer")}>
          <div className="footer-group">
            <h2 id="footer-explore">{t("Explore")}</h2>
            <ul className="footer-links" aria-labelledby="footer-explore">
              <li>
                <Link to="/whats-new">{t("What's new")}</Link>
              </li>
              <li>
                <Link to="/pricing">{t("Plans and pricing")}</Link>
              </li>
              <li>
                <Link to="/gifts">{t("Gift a membership")}</Link>
              </li>
              <li>
                <Link to="/affiliates">{t("Affiliate program")}</Link>
              </li>
              <li>
                <Link to="/search">{t("Search")}</Link>
              </li>
            </ul>
          </div>
          <div className="footer-group">
            <h2 id="footer-help">{t("Help")}</h2>
            <ul className="footer-links" aria-labelledby="footer-help">
              {pages("help")}
            </ul>
          </div>
          <div className="footer-group">
            <h2 id="footer-privacy">{t("Your privacy")}</h2>
            <ul className="footer-links" aria-labelledby="footer-privacy">
              {pages("privacy")}
              <li>
                <a
                  href="#"
                  className="termly-display-preferences"
                  onClick={(e) => {
                    e.preventDefault();
                    openConsentPreferences();
                  }}
                >
                  {t("Consent Preferences")}
                </a>
              </li>
              <li>
                {/* US privacy law sets this wording, so it stays in English. */}
                <a href={TERMLY_REQUESTS} lang="en">Do Not Sell or Share My Personal Information</a>
              </li>
              <li>
                <a href={TERMLY_REQUESTS} lang="en">Limit the Use of My Sensitive Personal Information</a>
              </li>
            </ul>
          </div>
          <div className="footer-group">
            <h2 id="footer-legal">{t("Legal")}</h2>
            <ul className="footer-links" aria-labelledby="footer-legal">
              {pages("legal")}
            </ul>
          </div>
        </nav>
      </div>
      <p className="footer-note">
        {t(
          "LiteraryWorm is a live service: members are billed monthly or yearly until they cancel. Accounts, libraries, logs and reading progress are saved with Supabase; the demo household stays in this browser tab and resets when you refresh. LiteraryWorm titles are sample data; other book details come from Google Books.",
        )}
      </p>
    </footer>
  );
}
