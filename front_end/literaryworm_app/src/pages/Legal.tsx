import { Link, useParams } from "react-router-dom";
import { legalPages } from "../data/legal";
import { useTitle } from "../lib/useTitle";
import NotFound from "./NotFound";

const updatedFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeZone: "UTC" });

export default function Legal() {
  const { slug } = useParams();
  const page = legalPages.find((p) => p.slug === slug);
  useTitle(page?.title ?? "");
  if (!page) return <NotFound />;
  return (
    <article className="page legal-page">
      <h1>{page.title}</h1>
      <p className="legal-summary">{page.summary}</p>
      {page.sections ? (
        <>
          {page.updated && (
            <p className="muted">
              Last updated <time dateTime={page.updated}>{updatedFormat.format(new Date(`${page.updated}T00:00:00Z`))}</time>
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
      <nav aria-label="Other policies">
        <ul className="legal-index">
          {legalPages
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
