import { Link, useParams } from "react-router-dom";
import { getBook } from "../data/books";
import { Placeholder } from "./Placeholder";

export default function Player() {
  const book = getBook(useParams().id);
  return (
    <Placeholder title={book ? `Listening to ${book.title}` : "Player"} phase={7}>
      <Link to={book ? `/books/${book.id}` : "/browse"}>Close player</Link>
    </Placeholder>
  );
}
