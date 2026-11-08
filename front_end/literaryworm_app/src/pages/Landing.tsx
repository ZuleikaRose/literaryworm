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
import { useBrowseGenres } from "../lib/useBrowseGenres";
import { landingFeatures } from "../data/landingFeatures";
import { formatPrice, planFaqs, plans } from "../data/plans";
import { StructuredData } from "../components/StructuredData";
import { genreOrderAfter, genreQuery, genresAfter, VISITOR_SAMPLE } from "../lib/feedChain";
import { useBookFeed } from "../lib/useBookFeed";
import { faqData, membershipData, siteDescription, pageData } from "../lib/seo";
import { useTitle } from "../lib/useTitle";
import { rich, tk, dateLocale } from "../lib/i18n";
import { useT } from "../lib/useT";
import { useStore } from "../store/context";
import type { AgeRating } from "../types";

const household: { name: string; avatar: number; rating: AgeRating; note: string }[] = [
  { name: "Avery", avatar: 0, rating: "all", note: tk("Everything in the catalog, plus the Account settings.") },
  { name: "Sam", avatar: 2, rating: "teen", note: tk("Teen and Kids titles. Reviews show a display name only.") },
  { name: "Mia", avatar: 4, rating: "kids", note: tk("Kids titles, big covers, no chat or payments. A daily limit and a bedtime if you set them.") },
];


export default function Landing() {
  const t = useT();
  const genreIds = useBrowseGenres().map((g) => g.id);
  useTitle(t("Read and listen in one place"), siteDescription());
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const freeTitles = books.filter((b) => b.publicDomain && b.featured).concat(books.filter((b) => b.publicDomain && !b.featured)).slice(0, 6);
  const classics = books.filter((b) => b.publicDomain).length;
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
      {t("Go to your profiles")} <Icon name="chevronRight" size={18} />
    </Link>
  ) : (
    <Link className="primary-button" to="/plans">
      {t("See plans and join")} <Icon name="chevronRight" size={18} />
    </Link>
  );

  return (
    <div className="landing">
      {params.get("deleted") === "1" && !state.account && (
        <div className="form-success landing-notice" role="status">
          <Icon name="check" size={17} />
          <p>{t("Your account has been deleted, and your plan won't charge you again. Thanks for reading with us.")}</p>
        </div>
      )}
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">{t("Ebooks and audiobooks")}</p>
          <h1 id="hero-title">
            {t("Stories worth")}
            <br />
            {t("staying up for.")}
          </h1>
          <p>
            {t("Read or listen to thousands of books in one place, keep your spot across every device, and give everyone at home a shelf of their own.")}
          </p>
          <div className="hero-actions">
            {primaryCta}
            {!state.account && (
              <button type="button" className="secondary-button" onClick={tryDemo}>
                {t("Try the demo")}
              </button>
            )}
          </div>
          <p className="hero-fine">{t("Plans from {price} a month. Cancel online any time.", { price: formatPrice(plans[0].price) })}</p>
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
          eyebrow={t("Browse without an account")}
          title={t("Popular in technology")}
          items={technology.items}
          status={technology.status}
          error={technology.error}
          // A sample for visitors; members (and the demo) can keep going.
          onLoadMore={state.account ? technology.loadMore : undefined}
          onRetry={technology.retry}
          action={
            <a className="view-all" href="#discover">
              {t("Browse by genre")} <Icon name="chevronRight" size={16} />
            </a>
          }
        />

        <section aria-labelledby="free-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("No account needed")}</p>
              <h2 id="free-title">{t("Free to read today")}</h2>
            </div>
            <p className="section-aside">{t("{n} public-domain classics, in full, to read and hear.", { n: classics.toLocaleString(dateLocale(t.lang)) })}</p>
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
            <p className="eyebrow">{t("One place, both formats")}</p>
            <h2 id="format-title">{t("Read on the train, listen on the walk home")}</h2>
            <p>
              {t("Most titles come as an ebook and an audiobook. Switch between them whenever you like and LiteraryWorm keeps your place, on your phone, tablet or laptop.")}
            </p>
            <dl className="format-facts">
              <div>
                <dt>
                  <Icon name="bookOpen" size={18} /> {t("Ebook")}
                </dt>
                <dd>{t("{n} pages, with adjustable text and sepia or dark themes", { n: dune.pages })}</dd>
              </div>
              <div>
                <dt>
                  <Icon name="headphones" size={18} /> {t("Audiobook")}
                </dt>
                <dd>{t("{n} hours, from 0.5× to 3× speed, with a sleep timer", { n: Math.round(listenMinutes(dune) / 60) })}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="feature-grid" aria-labelledby="features-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("More than a reader")}</p>
              <h2 id="features-title">{t("Everything that happens around a good book")}</h2>
            </div>
            <p className="section-aside">{t("Try most of it in the demo household, no account needed.")}</p>
          </div>
          <ul className="feature-list" role="list">
            {landingFeatures.map((f) => (
              <li key={f.title}>
                <span className="feature-icon" aria-hidden="true">
                  <Icon name={f.icon} size={22} />
                </span>
                <h3>{t(f.title)}</h3>
                <p>{t(f.body)}</p>
              </li>
            ))}
          </ul>
          <WhatsNewLink />
        </section>

        <section className="household" aria-labelledby="household-title">
          <div className="household-copy">
            <p className="eyebrow">{t("Family profiles")}</p>
            <h2 id="household-title">{t("A shelf for everyone at home")}</h2>
            <p>
              {t("Up to 12 profiles, each with its own lists, history and recommendations. Lock a profile with a PIN, set a daily limit, a weekly goal and a bedtime for younger readers, and get their week by email. Kids can ask you for a book above their shelf, and you check its content notes and say yes or no.")}
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
                      {h.name} <span className="rating-chip">{t(ageRatingLabel[h.rating])}</span>
                    </p>
                    <p className="household-note">{t(h.note)}</p>
                  </div>
                  <p className="household-count">
                    {rich(t.plural(count, { one: "{n} title", other: "{n} titles" }), { n: <strong>{count}</strong> })}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="plan-strip" aria-labelledby="plan-strip-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("Membership")}</p>
              <h2 id="plan-strip-title">{t("Three plans, no surprises")}</h2>
            </div>
            <Link className="text-button" to="/plans">
              {t("Compare plans")} <Icon name="chevronRight" size={16} />
            </Link>
          </div>
          <ul className="plan-strip-list">
            {plans.map((p) => (
              <li key={p.id}>
                <h3>{p.name}</h3>
                <p className="plan-strip-price">
                  {formatPrice(p.price)}
                  <span>{t("/month")}</span>
                </p>
                <p>
                  {p.profiles === 1 ? t("1 profile") : t("Up to {n} profiles", { n: p.profiles })}. {t(p.audioHours)}.
                </p>
              </li>
            ))}
          </ul>
        </section>

        <StructuredData id="page" data={pageData({ path: "/", name: "LiteraryWorm: read and listen in one place", description: siteDescription() })} />
        <StructuredData id="membership" data={membershipData()} />
        <StructuredData id="faq" data={faqData(planFaqs)} />
        <section className="faq" aria-labelledby="landing-faq-title">
          <h2 id="landing-faq-title">{t("Common questions")}</h2>
          <div className="faq-list">
            {planFaqs.map((f) => (
              <details key={f.q}>
                <summary>
                  {t(f.q)}
                  <Icon name="chevronDown" size={18} />
                </summary>
                {t(f.a).split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
              </details>
            ))}
          </div>
        </section>

        <section className="community-banner" aria-labelledby="cta-title">
          <span className="community-icon" aria-hidden="true">
            <Icon name="bookOpen" size={27} />
          </span>
          <div>
            <h2 id="cta-title">{t("Your next book is a few clicks away")}</h2>
            <p>{t("Join in a couple of minutes, or look around the demo household first.")}</p>
          </div>
          {state.account ? (
            <Link className="secondary-button" to="/profiles">
              {t("Go to your profiles")}
            </Link>
          ) : (
            <Link className="primary-button" to="/signup">
              {t("Create your account")}
            </Link>
          )}
        </section>

        <div id="discover">
          <BookFeed
            id="discover"
            eyebrow={t("Keep discovering")}
            title={t("{genre} books", { genre: t(genreLabel(genre)) })}
            query={genreQuery(genre)}
            controls={<GenreNav current={genre} basePath="/" />}
            // Logged in, it scrolls on through every genre; a visitor sees a sample, then an invitation.
            then={state.account ? genresAfter(genre, genreIds) : undefined}
            stepLabels={state.account ? [genre, ...genreOrderAfter(genre, genreIds)].map((g) => t(genreLabel(g))) : undefined}
            endText={state.account ? t("That's every genre. Pick one above to start again.") : undefined}
            sampleSize={state.account ? undefined : VISITOR_SAMPLE}
            sampleEnd={
              <div className="feed-sample-end">
                <h3>{t("Want to keep scrolling?")}</h3>
                <p>{t("Log in or join to scroll through every genre without stopping, or try the demo household first.")}</p>
                <div className="hero-actions">
                  <Link className="primary-button" to="/signin">
                    {t("Log in")}
                  </Link>
                  <Link className="secondary-button" to="/plans">
                    {t("See plans and join")}
                  </Link>
                  <button type="button" className="text-button" onClick={tryDemo}>
                    {t("Try the demo")}
                  </button>
                </div>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
