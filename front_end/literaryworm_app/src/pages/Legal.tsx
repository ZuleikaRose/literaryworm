import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { LegalEditor } from "../components/LegalEditor";
import { hasRole } from "../lib/staff";
import { replaceLegalPage, useLegalPages } from "../lib/useLegalPages";
import { useStaffRoles } from "../lib/useStaffRoles";
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
  useTitle(page?.title ?? "");
  if (!page) return <NotFound />;

  return (
    <article className="page legal-page">
      <h1 ref={heading} tabIndex={-1}>
        {page.title}
      </h1>
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
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
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
