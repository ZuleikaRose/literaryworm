import { useRef, useState } from "react";
import { HOME_CRUMB, pageData } from "../lib/seo";
import { StructuredData } from "../components/StructuredData";
import { Link, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { LegalEditor } from "../components/LegalEditor";
import { hasRole } from "../lib/staff";
import { replaceLegalPage, useLegalPages } from "../lib/useLegalPages";
import { useStaffRoles } from "../lib/useStaffRoles";
import { useT } from "../lib/useT";
import { useTitle } from "../lib/useTitle";
import NotFound from "./NotFound";

const updatedFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeZone: "UTC" });
// "2026-10-28" (built in) or a timestamp (edited in the app).
const updatedDate = (value: string) => new Date(value.length === 10 ? `${value}T00:00:00Z` : value);

/** /legal/:slug: a footer page, live from Supabase where it loads. Editors and admins can edit it here. */
export default function Legal() {
  const { slug } = useParams();
  const pages = useLegalPages();
  const page = pages.find((p) => p.slug === slug);
  const canEdit = hasRole(useStaffRoles(), "editor");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const t = useT();
  useTitle(page?.title ?? "");
  if (!page) return <NotFound />;

  return (
    // Policies and Help are written in English only, so the page says so to screen readers too.
    <article className="page legal-page" lang="en">
      <StructuredData
        id="page"
        data={pageData({
          path: `/legal/${page.slug}`,
          name: page.title,
          description: page.summary || undefined,
          dateModified: page.updated,
          crumbs: [HOME_CRUMB, { name: page.title, path: `/legal/${page.slug}` }],
        })}
      />
      <h1 ref={heading} tabIndex={-1}>
        {page.title}
      </h1>
      {t.lang !== "en" && (
        <p className="legal-language-note" role="note" lang={t.lang}>
          <Icon name="globe" size={16} /> {t("This page is only available in English. The English version is the one that applies.")}
        </p>
      )}
      {editing ? (
        <LegalEditor
          key={page.slug}
          page={page}
          onCancel={() => {
            setEditing(false);
            heading.current?.focus();
          }}
          onSaved={(next) => {
            replaceLegalPage(next);
            setEditing(false);
            setSaved(true);
            heading.current?.focus();
          }}
        />
      ) : (
        <>
          {canEdit && (
            <div className="legal-edit-bar">
              <button
                type="button"
                className="secondary-button small-button"
                onClick={() => {
                  setSaved(false);
                  setEditing(true);
                }}
              >
                <Icon name="edit" size={15} /> Edit page
              </button>
              <p className="form-success" role="status" hidden={!saved}>
                <Icon name="check" size={16} /> Saved and published.
              </p>
            </div>
          )}
          <p className="legal-summary">{page.summary}</p>
          {page.sections ? (
            <>
              {page.updated && (
                <p className="muted">
                  Last updated <time dateTime={page.updated}>{updatedFormat.format(updatedDate(page.updated))}</time>
                </p>
              )}
              {page.sections.map((section) => (
                <section key={section.heading} className="legal-section">
                  <h2>{section.heading}</h2>
                  {/* Keyed by place: a policy can repeat a sentence as its own paragraph, and the list is only shown. */}
                  {section.paragraphs.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </section>
              ))}
            </>
          ) : (
            <p className="muted">The full policy will be published here before launch.</p>
          )}
        </>
      )}
      <nav aria-label="Other policies">
        <ul className="legal-index">
          {pages
            .filter((p) => p.slug !== page.slug)
            .map((p) => (
              <li key={p.slug}>
                <Link to={`/legal/${p.slug}`}>{p.title}</Link>
              </li>
            ))}
        </ul>
      </nav>
    </article>
  );
}
