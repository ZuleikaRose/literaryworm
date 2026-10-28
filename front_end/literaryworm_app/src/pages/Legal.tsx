import { Link, useParams } from "react-router-dom";
import { legalPages } from "../data/legal";
import { useTitle } from "../lib/useTitle";
import NotFound from "./NotFound";

export default function Legal() {
  const { slug } = useParams();
  const page = legalPages.find((p) => p.slug === slug);
  useTitle(page?.title ?? "");
  if (!page) return <NotFound />;
  return (
    <article className="page legal-page">
      <h1>{page.title}</h1>
      <p className="legal-summary">{page.summary}</p>
      <p className="muted">The full policy will be published here before launch.</p>
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
