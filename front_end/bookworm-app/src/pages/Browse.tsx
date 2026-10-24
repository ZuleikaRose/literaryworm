import { BookCard } from "../components/BookCard";
import { books, isAllowed } from "../data/books";
import { useActiveProfile } from "../store/context";
import { Placeholder } from "./Placeholder";

/** Phase 0: shows the whole visible catalog so covers and age filtering can be checked. */
export default function Browse() {
  const profile = useActiveProfile();
  const visible = books.filter((b) => !profile || isAllowed(b.ageRating, profile.ageRating));
  return (
    <Placeholder title="Discover" phase={3}>
      <p className="muted">
        {visible.length} of {books.length} titles visible to this profile.
      </p>
      <div className="catalog-grid">
        {visible.map((b) => (
          <BookCard key={b.id} book={b} />
        ))}
      </div>
    </Placeholder>
  );
}
