import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { BookCard } from "../components/BookCard";
import { BookFeed } from "../components/BookFeed";
import { GenreNav } from "../components/GenreNav";
import { Shelf } from "../components/Shelf";
import { Cover } from "../components/Cover";
import { Icon } from "../components/Icon";
import { WhatsNewLink } from "../components/WhatsNewLink";
import { ageRatingLabel, books, getBook, isAllowed, listenMinutes } from "../data/books";
import { type BrowseGenre, genreLabel, isBrowseGenre } from "../data/genres";
import { formatPrice, planFaqs, plans } from "../data/plans";
import { useBookFeed } from "../lib/useBookFeed";
import { siteDescription } from "../lib/seo";
import { useTitle } from "../lib/useTitle";
import { useStore } from "../store/context";
import type { AgeRating } from "../types";

const household: { name: string; avatar: number; rating: AgeRating; note: string }[] = [
  { name: "Avery", avatar: 0, rating: "all", note: "Everything in the catalog, plus the Account settings." },
  { name: "Sam", avatar: 2, rating: "teen", note: "Teen and Kids titles. Reviews show a display name only." },
  { name: "Mia", avatar: 4, rating: "kids", note: "Kids titles, big covers, no chat or payments. A daily limit if you set one." },
];

const hours = (minutes: number) => `${Math.round(minutes / 60)} hours`;

export default function Landing() {
  useTitle("Read and listen in one place", siteDescription());
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const freeTitles = books.filter((b) => b.publicDomain && b.featured).concat(books.filter((b) => b.publicDomain && !b.featured)).slice(0, 6);
  const dune = getBook("dune")!;
  const [circe, midnight] = [getBook("circe")!, getBook("the-midnight-library")!];
  // The public home: books about technology from the books Edge Function (Google Books).
  const technology = useBookFeed({ mode: "home" });
  const [params] = useSearchParams();
  const genreParam = params.get("genre");
  const genre: BrowseGenre = isBrowseGenre(genreParam) ? genreParam : "technology";

  const tryDemo = () => {
    dispatch({ type: "startDemo" });
    navigate("/profiles");
  };

  const primaryCta = state.account ? (
    <Link className="primary-button" to="/profiles">
      Go to your profiles <Icon name="chevronRight" size={18} />
    </Link>
  ) : (
    <Link className="primary-button" to="/plans">
      See plans and join <Icon name="chevronRight" size={18} />
    </Link>
  );

  return (
    <div className="landing">
      {params.get("deleted") === "1" && !state.account && (
        <div className="form-success landing-notice" role="status">
          <Icon name="check" size={17} />
          <p>Your account has been deleted, and your plan won't charge you again. Thanks for reading with us.</p>
        </div>
      )}
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">Ebooks and audiobooks</p>
          <h1 id="hero-title">
            Stories worth
            <br />
            staying up for.
          </h1>
          <p>
            Read or listen to thousands of books in one place, keep your spot across every device, and give everyone at home
            a shelf of their own.
          </p>
          <div className="hero-actions">
            {primaryCta}
            {!state.account && (
              <button type="button" className="secondary-button" onClick={tryDemo}>
                Try the demo
              </button>
            )}
          </div>
          <p className="hero-fine">Plans from {formatPrice(plans[0].price)} a month. Cancel online any time.</p>
        </div>
        <div className="hero-books" aria-hidden="true">
          <div className="hero-book back">
            <Cover book={circe} size="lg" />
          </div>
          <div className="hero-book front">
            <Cover book={midnight} size="lg" />
          </div>
          <div className="hero-book edge">
            <Cover book={dune} size="lg" />
          </div>
        </div>
      </section>

      <div className="page-content">
        <Shelf
          id="technology"
          eyebrow="Browse without an account"
          title="Popular in technology"
          items={technology.items}
          status={technology.status}
          error={technology.error}
          onLoadMore={technology.loadMore}
          onRetry={technology.retry}
          action={
            <a className="view-all" href="#discover">
              Browse by genre <Icon name="chevronRight" size={16} />
            </a>
          }
        />

        <section aria-labelledby="free-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">No account needed</p>
              <h2 id="free-title">Free to read today</h2>
            </div>
            <p className="section-aside">Public-domain classics anyone can open.</p>
          </div>
          <ul className="book-row" role="list">
            {freeTitles.map((b) => (
              <li key={b.id}>
                <BookCard book={b} />
              </li>
            ))}
          </ul>
        </section>

        <section className="format-split" aria-labelledby="format-title">
          <div className="format-cover">
            <Cover book={dune} size="xl" />
          </div>
          <div className="format-copy">
            <p className="eyebrow">One place, both formats</p>
            <h2 id="format-title">Read on the train, listen on the walk home</h2>
            <p>
              Most titles come as an ebook and an audiobook. Switch between them whenever you like and LiteraryWorm keeps your
              place, on your phone, tablet or laptop.
            </p>
            <dl className="format-facts">
              <div>
                <dt>
                  <Icon name="bookOpen" size={18} /> Ebook
                </dt>
                <dd>{dune.pages} pages, with adjustable text and sepia or dark themes</dd>
              </div>
              <div>
                <dt>
                  <Icon name="headphones" size={18} /> Audiobook
                </dt>
                <dd>{hours(listenMinutes(dune))}, from 0.5× to 3× speed, with a sleep timer</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="household" aria-labelledby="household-title">
          <div className="household-copy">
            <p className="eyebrow">Family profiles</p>
            <h2 id="household-title">A shelf for everyone at home</h2>
            <p>
              Up to 12 profiles, each with its own lists, history and recommendations. Lock a profile with a PIN, and set a
              daily reading limit for younger readers.
            </p>
          </div>
          <ul className="household-list">
            {household.map((h) => {
              const count = books.filter((b) => isAllowed(b.ageRating, h.rating)).length;
              return (
                <li key={h.name}>
                  <Avatar name={h.name} avatar={h.avatar} size={52} />
                  <div>
                    <p className="household-name">
                      {h.name} <span className="rating-chip">{ageRatingLabel[h.rating]}</span>
                    </p>
                    <p className="household-note">{h.note}</p>
                  </div>
                  <p className="household-count">
                    <strong>{count}</strong> titles
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="plan-strip" aria-labelledby="plan-strip-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Membership</p>
              <h2 id="plan-strip-title">Three plans, no surprises</h2>
            </div>
            <Link className="text-button" to="/plans">
              Compare plans <Icon name="chevronRight" size={16} />
            </Link>
          </div>
          <ul className="plan-strip-list">
            {plans.map((p) => (
              <li key={p.id}>
                <h3>{p.name}</h3>
                <p className="plan-strip-price">
                  {formatPrice(p.price)}
                  <span>/month</span>
                </p>
                <p>
                  {p.profiles === 1 ? "1 profile" : `Up to ${p.profiles} profiles`}. {p.audioHours}.
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="faq" aria-labelledby="landing-faq-title">
          <h2 id="landing-faq-title">Common questions</h2>
          <div className="faq-list">
            {planFaqs.map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q}
                  <Icon name="chevronDown" size={18} />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
          <WhatsNewLink />
        </section>

        <section className="community-banner" aria-labelledby="cta-title">
          <span className="community-icon" aria-hidden="true">
            <Icon name="bookOpen" size={27} />
          </span>
          <div>
            <h2 id="cta-title">Your next book is a few clicks away</h2>
            <p>Join in a couple of minutes, or look around the demo household first.</p>
          </div>
          {state.account ? (
            <Link className="secondary-button" to="/profiles">
              Go to your profiles
            </Link>
          ) : (
            <Link className="primary-button" to="/signup">
              Create your account
            </Link>
          )}
        </section>

        <div id="discover">
          <BookFeed
            id="discover"
            eyebrow="Keep discovering"
            title={`${genreLabel(genre)} books`}
            query={genre === "technology" ? { mode: "home" } : { mode: "genre", genre }}
            controls={<GenreNav current={genre} basePath="/" />}
          />
        </div>
      </div>
    </div>
  );
}
