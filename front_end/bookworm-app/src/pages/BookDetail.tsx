import { useParams } from "react-router-dom";
import { getBook } from "../data/books";
import NotFound from "./NotFound";
import { Placeholder } from "./Placeholder";

export default function BookDetail() {
  const book = getBook(useParams().id);
  if (!book) return <NotFound />;
  return <Placeholder title={book.title} phase={4} />;
}
