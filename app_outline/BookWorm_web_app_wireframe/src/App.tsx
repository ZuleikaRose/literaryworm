import { useEffect, useMemo, useRef, useState } from "react";

type IconName =
  | "arrow"
  | "bookmark"
  | "bookOpen"
  | "chevron"
  | "close"
  | "library"
  | "search"
  | "star"
  | "user";

type Book = {
  id: string;
  title: string;
  author: string;
  genre: string;
  year: string;
  rating: string;
  cover: string;
  blurb: string;
};

const books: Book[] = [
  {
    id: "the-midnight-library",
    title: "The Midnight Library",
    author: "Matt Haig",
    genre: "Fiction",
    year: "2020",
    rating: "4.3",
    cover: "midnight",
    blurb:
      "Between life and death there is a library. When Nora Seed finds herself there, she discovers each book offers a chance to try another life she might have lived.",
  },
  {
    id: "tomorrow",
    title: "Tomorrow, and Tomorrow, and Tomorrow",
    author: "Gabrielle Zevin",
    genre: "Literary fiction",
    year: "2022",
    rating: "4.5",
    cover: "tomorrow",
    blurb:
      "Two friends—often in love, but never lovers—come together as creative partners in the world of video game design.",
  },
  {
    id: "dune",
    title: "Dune",
    author: "Frank Herbert",
    genre: "Science fiction",
    year: "1965",
    rating: "4.7",
    cover: "dune",
    blurb:
      "Set on the desert planet Arrakis, Dune is the story of Paul Atreides and a destiny greater than he could ever have imagined.",
  },
  {
    id: "educated",
    title: "Educated",
    author: "Tara Westover",
    genre: "Memoir",
    year: "2018",
    rating: "4.6",
    cover: "educated",
    blurb:
      "An unforgettable memoir about a young woman who leaves her survivalist family and goes on to earn a PhD from Cambridge University.",
  },
  {
    id: "circe",
    title: "Circe",
    author: "Madeline Miller",
    genre: "Mythology",
    year: "2018",
    rating: "4.4",
    cover: "circe",
    blurb:
      "A bold retelling of the goddess Circe's story: exile, transformation, and a life lived on her own terms.",
  },
  {
    id: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    genre: "Self-development",
    year: "2018",
    rating: "4.8",
    cover: "atomic",
    blurb:
      "A practical guide to creating good habits, breaking bad ones, and mastering the tiny behaviors that lead to remarkable results.",
  },
  {
    id: "sea-of-tranquility",
    title: "Sea of Tranquility",
    author: "Emily St. John Mandel",
    genre: "Science fiction",
    year: "2022",
    rating: "4.2",
    cover: "sea",
    blurb:
      "A novel of art, time, love, and plague that takes the reader from Vancouver Island in 1912 to a dark colony on the moon.",
  },
  {
    id: "babel",
    title: "Babel",
    author: "R. F. Kuang",
    genre: "Fantasy",
    year: "2022",
    rating: "4.5",
    cover: "babel",
    blurb:
      "A thematic response to The Secret History and a tonal response to Jonathan Strange & Mr Norrell, set in an alternate Oxford.",
  },
];

const logs = [
  {
    initials: "MK",
    name: "Maya K.",
    time: "2 days ago",
    progress: "Finished",
    text: "The central idea stayed with me: regret can feel infinite, but so can possibility. A tender, quick read that landed at exactly the right moment.",
  },
  {
    initials: "JL",
    name: "Jonas Lee",
    time: "1 week ago",
    progress: "Page 184",
    text: "I like the episodic structure more than I expected. Each life is a small thought experiment, but Nora's voice keeps the book grounded.",
  },
  {
    initials: "SP",
    name: "Sofia Patel",
    time: "3 weeks ago",
    progress: "Finished",
    text: "Accessible and hopeful without pretending that change is easy. The swimming-pool chapter was my favorite.",
  },
];

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="m15 18-6-6 6-6" /><path d="M9 12h10" /></>,
    bookmark: <path d="M6 3h12v18l-6-4-6 4Z" />,
    bookOpen: <><path d="M3 5.5A3.5 3.5 0 0 1 6.5 2H11v17H6.5A3.5 3.5 0 0 0 3 22Z" /><path d="M21 5.5A3.5 3.5 0 0 0 17.5 2H13v17h4.5A3.5 3.5 0 0 1 21 22Z" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    library: <><path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l3-1 3 15-3 1z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function Cover({ book, large = false }: { book: Book; large?: boolean }) {
  return (
    <div className={`book-cover cover-${book.cover}${large ? " cover-large" : ""}`}>
      <span className="cover-kicker">{book.genre}</span>
      <strong>{book.title}</strong>
      <small>{book.author}</small>
    </div>
  );
}

function AppHeader({
  query,
  setQuery,
  goHome,
  signedIn,
  onLogin,
  onSignup,
  onLogout,
}: {
  query: string;
  setQuery: (value: string) => void;
  goHome: () => void;
  signedIn: boolean;
  onLogin: () => void;
  onSignup: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="topbar">
      <button className="brand" onClick={goHome} aria-label="BookWorm home">
        <span className="brand-mark"><Icon name="bookOpen" size={19} /></span>
        <strong>Book<span>Worm</span></strong>
      </button>
      <label className="search-box">
        <Icon name="search" size={19} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search books, authors, genres" />
        <kbd>⌘ K</kbd>
      </label>
      <nav className="desktop-nav" aria-label="Primary">
        <button className="active">Discover</button>
        <button>My Library</button>
      </nav>
      <div className="auth-menu">
        {signedIn ? (
          <>
            <button className="profile-button" aria-label="Open profile"><span>AB</span><span>Avery</span></button>
            <button className="login-button" onClick={onLogout}>Log out</button>
          </>
        ) : (
          <>
            <button className="login-button" onClick={onLogin}>Log in</button>
            <button className="signup-button" onClick={onSignup}>Sign up</button>
          </>
        )}
      </div>
    </header>
  );
}

function BookCard({ book, onSelect }: { book: Book; onSelect: (book: Book) => void }) {
  return (
    <button className="book-card" onClick={() => onSelect(book)}>
      <Cover book={book} />
      <span className="book-card-copy">
        <strong>{book.title}</strong>
        <small>{book.author}</small>
        <span className="rating"><Icon name="star" size={13} /> {book.rating}</span>
      </span>
    </button>
  );
}

function Home({
  filteredBooks,
  onSelect,
}: {
  filteredBooks: Book[];
  onSelect: (book: Book) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(12);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(12);
  }, [filteredBooks]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || filteredBooks.length === 0) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((count) => count + 8);
        }
      },
      { rootMargin: "300px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredBooks.length]);

  const loadedBooks = Array.from(
    { length: visibleCount },
    (_, index) => filteredBooks[index % filteredBooks.length],
  ).filter(Boolean);

  return (
    <>
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-copy">
          <span className="eyebrow">BOOKWORM EDITORS' PICK</span>
          <h1>Stories worth<br />staying up for.</h1>
          <p>Discover your next great read, keep every book close, and share the thoughts that stayed with you.</p>
          <button className="primary-button" onClick={() => onSelect(books[0])}>Explore featured book <Icon name="chevron" size={18} /></button>
        </div>
        <div className="hero-books" aria-hidden="true">
          <div className="hero-book back"><Cover book={books[4]} large /></div>
          <div className="hero-book front"><Cover book={books[0]} large /></div>
          <div className="hero-book edge"><Cover book={books[2]} large /></div>
        </div>
      </section>

      <main className="page-content">
        <div className="section-heading">
          <div><span className="eyebrow">CURATED FOR YOU</span><h2>Trending this week</h2></div>
          <button>View all <Icon name="chevron" size={16} /></button>
        </div>
        <div className="book-row">
          {filteredBooks.slice(0, 6).map((book) => <BookCard key={book.id} book={book} onSelect={onSelect} />)}
        </div>

        <section className="community-banner">
          <span className="community-icon"><Icon name="bookOpen" size={27} /></span>
          <div><span className="eyebrow">THE READING ROOM</span><h3>What readers are talking about</h3><p>Explore fresh notes, favorite passages, and thoughtful reviews from the community.</p></div>
          <button>Browse reader logs <Icon name="chevron" size={17} /></button>
        </section>

        <div className="section-heading second">
          <div><span className="eyebrow">FIND SOMETHING NEW</span><h2>Because you read fiction</h2></div>
          <button>View all <Icon name="chevron" size={16} /></button>
        </div>
        <div className="book-row compact">
          {filteredBooks.slice(2).map((book) => <BookCard key={book.id} book={book} onSelect={onSelect} />)}
        </div>

        <div className="section-heading catalog-heading">
          <div><span className="eyebrow">THE BOOKWORM CATALOG</span><h2>Keep discovering</h2></div>
          <span className="results-count">{loadedBooks.length} books loaded</span>
        </div>
        {loadedBooks.length > 0 ? (
          <div className="catalog-grid">
            {loadedBooks.map((book, index) => (
              <BookCard key={`${book.id}-${index}`} book={book} onSelect={onSelect} />
            ))}
          </div>
        ) : (
          <div className="empty-results"><Icon name="search" size={28} /><h3>No books found</h3><p>Try a different title, author, or genre.</p></div>
        )}
        <div className="load-trigger" ref={loadMoreRef} aria-live="polite">
          {loadedBooks.length > 0 && <><span /><span /><span /><small>Loading more books</small></>}
        </div>
      </main>
    </>
  );
}

function BookDetail({
  book,
  saved,
  onSave,
  onBack,
  onWriteLog,
}: {
  book: Book;
  saved: boolean;
  onSave: () => void;
  onBack: () => void;
  onWriteLog: () => void;
}) {
  return (
    <main className="detail-page">
      <button className="back-button" onClick={onBack}><Icon name="arrow" size={18} /> Back to discover</button>
      <section className="book-hero">
        <div className="detail-cover-wrap"><Cover book={book} large /></div>
        <div className="book-info">
          <span className="eyebrow">{book.genre.toUpperCase()} · {book.year}</span>
          <h1>{book.title}</h1>
          <p className="byline">by <strong>{book.author}</strong></p>
          <div className="book-meta"><span><Icon name="star" size={16} /> {book.rating}</span><span>428 ratings</span><span>304 pages</span></div>
          <p className="book-blurb">{book.blurb}</p>
          <div className="detail-actions">
            <button className={saved ? "primary-button saved" : "primary-button"} onClick={onSave}><Icon name="bookmark" size={18} /> {saved ? "Saved to library" : "Add to my library"}</button>
            <button className="secondary-button" onClick={onWriteLog}>Write a log</button>
          </div>
          <p className="privacy-note"><Icon name="library" size={15} /> Your library and reading status are private. Logs you publish are public.</p>
        </div>
      </section>

      <section className="logs-section">
        <div className="logs-intro">
          <span className="eyebrow">COMMUNITY NOTES</span>
          <h2>Reader logs</h2>
          <p>Ideas, reactions, and moments worth remembering from people reading this book.</p>
        </div>
        <div className="logs-list">
          {logs.map((log) => (
            <article className="log-card" key={log.name}>
              <div className="log-header">
                <span className="reader-avatar">{log.initials}</span>
                <div><button className="reader-name">{log.name}</button><small>{log.time}</small></div>
                <span className="progress-chip"><Icon name="bookOpen" size={13} /> {log.progress}</span>
              </div>
              <p>“{log.text}”</p>
              <button className="read-log">Read full log <Icon name="chevron" size={14} /></button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [query, setQuery] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState("");
  const [published, setPublished] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup" | null>(null);

  const filteredBooks = useMemo(() => {
    const term = query.toLowerCase().trim();
    return term ? books.filter((book) => `${book.title} ${book.author} ${book.genre}`.toLowerCase().includes(term)) : books;
  }, [query]);

  const toggleSave = () => {
    if (!selectedBook) return;
    if (!signedIn) {
      setAuthMode("login");
      return;
    }
    setSavedIds((current) => current.includes(selectedBook.id) ? current.filter((id) => id !== selectedBook.id) : [...current, selectedBook.id]);
  };

  const completeAuth = () => {
    setSignedIn(true);
    setAuthMode(null);
  };

  return (
    <div className="app">
      <AppHeader
        query={query}
        setQuery={setQuery}
        goHome={() => setSelectedBook(null)}
        signedIn={signedIn}
        onLogin={() => setAuthMode("login")}
        onSignup={() => setAuthMode("signup")}
        onLogout={() => { setSignedIn(false); setSavedIds([]); }}
      />
      {selectedBook ? (
        <BookDetail
          book={selectedBook}
          saved={savedIds.includes(selectedBook.id)}
          onSave={toggleSave}
          onBack={() => setSelectedBook(null)}
          onWriteLog={() => {
            if (!signedIn) {
              setAuthMode("login");
              return;
            }
            setPublished(false);
            setWriting(true);
          }}
        />
      ) : <Home filteredBooks={filteredBooks} onSelect={setSelectedBook} />}

      {writing && (
        <div className="modal-wrap" role="dialog" aria-modal="true" aria-label="Write a public reading log">
          <button className="scrim" onClick={() => setWriting(false)} aria-label="Close" />
          <section className="log-modal">
            <button className="modal-close" onClick={() => setWriting(false)} aria-label="Close"><Icon name="close" /></button>
            {published ? (
              <div className="published-state"><span><Icon name="bookOpen" size={28} /></span><p className="eyebrow">LOG PUBLISHED</p><h2>Your note joined the conversation.</h2><p>Readers can now find it on this book’s page. Your personal library remains private.</p><button className="primary-button" onClick={() => setWriting(false)}>Done</button></div>
            ) : (
              <>
                <span className="eyebrow">PUBLIC READING LOG</span>
                <h2>What stayed with you?</h2>
                <p>Share a thought about <strong>{selectedBook?.title}</strong>. Your profile name will appear with this log.</p>
                <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write about an idea, moment, or passage..." rows={6} />
                <div className="modal-foot"><span><Icon name="user" size={14} /> Posting as Avery Brooks</span><button className="primary-button" disabled={!draft.trim()} onClick={() => setPublished(true)}>Publish log</button></div>
              </>
            )}
          </section>
        </div>
      )}

      {authMode && (
        <div className="modal-wrap" role="dialog" aria-modal="true" aria-label={authMode === "login" ? "Log in to BookWorm" : "Create a BookWorm account"}>
          <button className="scrim" onClick={() => setAuthMode(null)} aria-label="Close" />
          <section className="log-modal auth-modal">
            <button className="modal-close" onClick={() => setAuthMode(null)} aria-label="Close"><Icon name="close" /></button>
            <span className="brand-mark auth-brand"><Icon name="bookOpen" size={21} /></span>
            <span className="eyebrow">{authMode === "login" ? "WELCOME BACK" : "JOIN BOOKWORM"}</span>
            <h2>{authMode === "login" ? "Log in to your account" : "Create your reader profile"}</h2>
            <p>{authMode === "login" ? "Access your private library and continue writing reading logs." : "Save books privately and join the public reading conversation."}</p>
            {authMode === "signup" && (
              <label className="auth-field"><span>Display name</span><input type="text" placeholder="How readers will know you" /></label>
            )}
            <label className="auth-field"><span>Email address</span><input type="email" placeholder="you@example.com" /></label>
            <label className="auth-field"><span>Password</span><input type="password" placeholder="At least 8 characters" /></label>
            <button className="primary-button auth-submit" onClick={completeAuth}>{authMode === "login" ? "Log in" : "Create account"}</button>
            <div className="auth-switch">
              <span>{authMode === "login" ? "New to BookWorm?" : "Already have an account?"}</span>
              <button onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}>{authMode === "login" ? "Sign up" : "Log in"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
