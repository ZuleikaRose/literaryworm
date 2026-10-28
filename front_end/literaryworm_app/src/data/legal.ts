/** The Children's Privacy Notice version a parent agrees to when creating a Kids profile. */
export const CHILDREN_NOTICE_VERSION = "2026-10";

export interface LegalPage {
  slug: string;
  title: string;
  summary: string;
  /** The page in full, when it's written; pages without sections are placeholders until legal provides final copy. */
  sections?: { heading: string; paragraphs: string[] }[];
  /** When the full page last changed (ISO date). */
  updated?: string;
}

/** Footer pages. Pages without `sections` are placeholders until legal provides final copy. */
export const legalPages: LegalPage[] = [
  {
    slug: "accessibility",
    title: "Accessibility Policy",
    summary:
      "LiteraryWorm aims to meet WCAG 2.2 AA. Use the accessibility menu in the header to change text size, font, contrast and motion. Press ? on any page to see keyboard shortcuts.",
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    summary: "What we collect, why we collect it, how long we keep it, and how to download or delete it.",
  },
  {
    slug: "cookies",
    title: "Cookie Policy",
    summary:
      "LiteraryWorm doesn't use cookies for advertising or tracking, and sets none of its own. This page lists what the app does keep in your browser, and why.",
    updated: "2026-10-28",
    sections: [
      {
        heading: "Cookies",
        paragraphs: [
          "LiteraryWorm sets no cookies. We don't use advertising, analytics or tracking cookies, and we don't let advertisers or social networks place them through our pages.",
          "Some book covers from Google Books, and the audiobook recordings streamed from the Internet Archive, load from those services. When your browser fetches them, those services may set or read their own cookies under their own policies. Blocking third-party cookies in your browser doesn't stop LiteraryWorm working.",
        ],
      },
      {
        heading: "What we keep in your browser",
        paragraphs: [
          "Signed in: when you log in, your browser keeps your sign-in session (in local storage, under literaryworm-session) so you stay signed in after a refresh. It's strictly necessary for your account to work, and it's removed when you log out.",
          "The app itself: so LiteraryWorm opens quickly and without a connection, your browser keeps a copy of the app's own files (its pages, code, icons and app manifest). This holds nothing about you.",
          "Books you save for offline: when you choose Read offline, the book's text, and its audio if you ask, are kept on your device until you remove them from the book's page.",
          "Everything else, such as reader settings, playback speed, the demo household and uploads made in the demo, stays in the open tab only and is gone when you refresh or close it.",
        ],
      },
      {
        heading: "What's saved with your account instead",
        paragraphs: [
          "Your library, reading progress, bookmarks, highlights, lists, ratings, reading time, player settings, club activity and uploaded books are saved with your account on our servers (Supabase), not in browser cookies. The Privacy Policy says how we use them, and Account lets you download or delete them.",
        ],
      },
      {
        heading: "Your choices",
        paragraphs: [
          "Because LiteraryWorm uses only what's strictly necessary, there's nothing to opt into and no cookie banner. You can clear what's kept at any time in your browser's site settings; you'll be signed out, and books saved for offline will need saving again. Notifications and installing the app as an app are always your choice, asked for by your browser.",
          "If this changes, for example if we ever add optional cookies, we'll ask you first and update this page.",
        ],
      },
    ],
  },
  {
    slug: "childrens-privacy",
    title: "Children's Privacy Notice",
    summary:
      "For parents: Kids profiles collect only what the service needs (profile, reading progress, lists, ratings and screen time), only after you consent. You can review, delete or stop collection at any time from Account.",
  },
  {
    slug: "privacy-choices",
    title: "Your Privacy Choices",
    summary: "LiteraryWorm uses no non-essential cookies (see the Cookie Policy), so there are none to opt out of. Opt out of any sale or sharing of personal information. Global Privacy Control is honored.",
  },
  {
    slug: "terms",
    title: "Terms of Service",
    summary: "Account holders must be 18 or older. Subscriptions renew automatically until you cancel, which you can do online at any time.",
  },
  {
    slug: "copyright",
    title: "Copyright/DMCA",
    summary: "How rights holders can report infringing content to our designated agent.",
  },
  {
    slug: "help",
    title: "Help",
    summary: "Answers to common questions, and how to report a problem.",
  },
  {
    slug: "status",
    title: "Status",
    summary: "All systems are working normally.",
  },
];
