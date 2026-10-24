import { Link, useParams } from "react-router-dom";
import { getBook } from "../data/books";
import { Placeholder } from "./Placeholder";

export default function Reader() {
  const book = getBook(useParams().id);
  return (
    <Placeholder title={book ? `Reading ${book.title}` : "Reader"} phase={7}>
      <Link to={book ? `/book/${book.id}` : "/browse"}>Close reader</Link>
    </Placeholder>
  );
}
