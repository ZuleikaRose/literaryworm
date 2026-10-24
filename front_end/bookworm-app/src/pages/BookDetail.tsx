import { useParams } from "react-router-dom";
import { getBook } from "../data/books";
import NotFound from "./NotFound";
import { Placeholder } from "./Placeholder";

/** Google Books volume ids (the same check the books Edge Function makes). */
const VOLUME_ID = /^[A-Za-z0-9_-]{1,40}$/;

export default function BookDetail() {
  const id = useParams().id;
  const book = getBook(id);
  if (book) return <Placeholder title={book.title} phase={4} />;
  if (!id || !VOLUME_ID.test(id)) return <NotFound />;
  return <Placeholder title="Book details" phase={4} />;
}
