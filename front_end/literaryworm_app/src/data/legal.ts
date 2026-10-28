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
    summary: "What we collect, why we collect it, who helps us run the service, how long we keep it, and how to download or delete it. We don't sell or license your personal information to anyone.",
    updated: "2026-10-28",
    sections: [
      {
        heading: "What we collect",
        paragraphs: [
          "Your account: your email address, display name, date of birth (to confirm you're 18 or over), whether you'd like marketing emails, when you accepted the Terms, and your plan. Your password is handled by our sign-in provider; we never see it.",
          "Your household: each profile's name, avatar, age rating, favourite genres, daily limit and player settings. A profile PIN is kept only as a one-way hash. For Kids profiles, we keep a record of the parent's consent.",
          "Your reading: your library, reading progress, bookmarks, highlights and notes, ratings, favourites and lists, recent searches, reading goals, time read and listened each day, and the books you finish.",
          "Things you share or add: reading logs (public, with your display name), book club posts (seen by the club's members), lists you choose to share by link, and books you upload (private to the profile that added them; we keep their text only).",
          "Devices: while you're signed in, a short label for each open copy of the app (such as \u201cChrome on Windows\u201d) so you can send a book to another device.",
        ],
      },
      {
        heading: "Who helps us run LiteraryWorm",
        paragraphs: [
          "Supabase stores the data above and runs our server functions. Vercel hosts the website. Neither may use your data for their own purposes.",
          "Anthropic (Claude) writes book summaries, and answers Ask the book questions. For Ask the book, we send your question and the book's public-domain text up to your chapter; we don't send your name, email or account details.",
          "Google Books answers searches and book details through our server, which sends only the search words and book ids, never who's asking. LibriVox recordings stream from the Internet Archive, and fonts load from Google Fonts, directly from your browser.",
        ],
      },
      {
        heading: "Licensing and selling your information",
        paragraphs: [
          "We don't sell, rent or license your personal information, and we don't share it for advertising. We use it only to run LiteraryWorm for you.",
          "Content you post (reading logs and club posts) stays yours. The Terms of Service explain the limited licence you give us to show it where you posted it.",
          "We don't use your reading history, notes, uploads or posts to train AI models.",
        ],
      },
      {
        heading: "How long we keep it",
        paragraphs: [
          "We keep your data while your account is open. Deleting a profile deletes its data, including its uploaded books. Deleting your account deletes everything at once, including your uploads; public logs and club posts go with it.",
          "To protect the service from abuse, we keep short-lived counts of requests, keyed by a one-way hash of your account or network address, and clear them within a day.",
        ],
      },
      {
        heading: "Your choices and rights",
        paragraphs: [
          "In Account you can download a copy of your data, change your display name and marketing emails, and delete profiles or your whole account. You can remove any log, post, highlight or upload yourself.",
          "We honour Global Privacy Control. Children's data is covered by the Children's Privacy Notice, and what we keep in your browser by the Cookie Policy.",
        ],
      },
    ],
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
    summary:
      "The agreement between you and LiteraryWorm: who can have an account, how membership works, what you may do with the books, who owns what, and the licence you give us for what you post.",
    updated: "2026-10-28",
    sections: [
      {
        heading: "Your account",
        paragraphs: [
          "Account holders must be 18 or older. You may add profiles for people in your household, including Kids profiles with your consent, and you're responsible for how they're used.",
          "Keep your password private. You can change it, and delete your account, from Account at any time.",
        ],
      },
      {
        heading: "Membership",
        paragraphs: [
          "Plans renew automatically each month until you cancel, which you can do online at any time; reading continues until the end of the period you've paid for. You can pause and resume from Account.",
          "LiteraryWorm is currently a demonstration: choosing a plan saves it to your account, but no payment is taken.",
        ],
      },
      {
        heading: "Your licence to read and listen",
        paragraphs: [
          "While your membership is active, we give you a personal, non-exclusive, non-transferable, revocable licence to read and listen to the books in LiteraryWorm for your own and your household's non-commercial use, in the app.",
          "You may not copy, sell, share, broadcast or publicly perform the books, remove or get around any protection on them, or use them to train AI models. Books saved for offline reading stay in the app on your device.",
          "This licence doesn't apply to public-domain works themselves, which anyone may use freely; it covers our app, our edition and our service.",
        ],
      },
      {
        heading: "Who owns the books and the app",
        paragraphs: [
          "Public-domain titles: the texts come from Project Gutenberg and the recordings from LibriVox, whose volunteers release their recordings into the public domain. These works are in the public domain in the United States; they may not be everywhere, so check your country's rules before using them outside LiteraryWorm.",
          "Other LiteraryWorm titles show sample pages, not the published books. Book details and covers from Google Books belong to their publishers and rights holders and are shown under Google's terms.",
          "Summaries and Ask the book answers are written by AI (Claude) and labelled so. They may be wrong; they're provided for your own reading and may not be republished as LiteraryWorm's.",
          "The LiteraryWorm name, logo, design and software belong to LiteraryWorm. Using the service doesn't give you any rights in them beyond these Terms.",
        ],
      },
      {
        heading: "What you post, and the licence you give us",
        paragraphs: [
          "You own what you write: reading logs, club posts, list names and descriptions, notes and highlights.",
          "So we can run the features you use, you give LiteraryWorm a worldwide, non-exclusive, royalty-free licence to store, copy and display what you post, only where and to whom you posted it (logs on the book's public page with your display name, club posts to the club, shared lists to anyone with the link). The licence ends when you delete the content or your account, except for copies already made by others, such as someone else's screenshot.",
          "Notes, highlights and private lists are never shown to anyone else.",
        ],
      },
      {
        heading: "Books you upload",
        paragraphs: [
          "Upload only books you have the right to read in this way, such as DRM-free books you've bought or works in the public domain. Don't upload books you don't have rights to, and don't remove DRM to upload them.",
          "Your uploads stay private to the profile that added them. We store their text only to show it to you, claim no rights in them, and delete them when you do or when you delete the profile or account.",
        ],
      },
      {
        heading: "Rules, changes and ending",
        paragraphs: [
          "Don't post anything unlawful, hateful, harassing or infringing, impersonate others, spam clubs, or try to break or overload the service. We may remove content that breaks these rules and suspend accounts that keep doing so, including repeat copyright infringers (see Copyright/DMCA).",
          "LiteraryWorm is provided as is. We'll tell you before changing these Terms in ways that matter, and you can cancel or delete your account at any time.",
        ],
      },
    ],
  },
  {
    slug: "copyright",
    title: "Copyright/DMCA",
    summary:
      "How LiteraryWorm respects copyright, which works are in the public domain, and how a rights holder can report content they believe infringes, under the Digital Millennium Copyright Act (DMCA).",
    updated: "2026-10-28",
    sections: [
      {
        heading: "Our books and their licences",
        paragraphs: [
          "Public-domain titles use texts from Project Gutenberg and recordings from LibriVox, which LibriVox volunteers release into the public domain. These works are in the public domain in the United States, where LiteraryWorm operates. Our copies leave out Project Gutenberg's own header, footer and licence text.",
          "Other titles show sample pages written for LiteraryWorm, not the published books, and book details and covers come from Google Books under Google's terms.",
          "If you believe any of this is wrong, for example that a work isn't in the public domain, tell us using the steps below and we'll look into it promptly.",
        ],
      },
      {
        heading: "What people post or upload",
        paragraphs: [
          "Reading logs, club posts and shared lists are written by members, who keep their rights in them. Books members upload are private to their own profile and aren't shown to anyone else; members must have the right to read them that way (see the Terms of Service).",
        ],
      },
      {
        heading: "Reporting infringement",
        paragraphs: [
          "If you believe something on LiteraryWorm infringes your copyright, send our designated agent a written notice that includes: your physical or electronic signature; the work you believe is infringed; the material on LiteraryWorm you want removed and where it is (a link helps); your name, address, phone number and email; a statement that you believe in good faith the use isn't authorised by the copyright owner, its agent or the law; and a statement, under penalty of perjury, that the notice is accurate and that you are, or are authorised to act for, the owner.",
          "Our designated agent's name, postal address, phone number and email, as registered with the U.S. Copyright Office, will be listed here before launch.",
          "We remove or disable access to the material, tell the member who posted it, and keep a record of the notice.",
        ],
      },
      {
        heading: "Counter-notices",
        paragraphs: [
          "If your content was removed and you believe that was a mistake or that you had the right to post it, you may send a counter-notice with: your signature; what was removed and where it was; a statement, under penalty of perjury, that you believe in good faith it was removed by mistake or misidentification; your name, address and phone number; and your consent to the jurisdiction of the federal court for your address (or, outside the United States, any district where LiteraryWorm may be found) and to accept service from the person who sent the notice.",
          "We forward it to the person who sent the notice and may restore the content in 10 to 14 business days unless they tell us they've filed a court action.",
        ],
      },
      {
        heading: "Repeat infringers and false claims",
        paragraphs: [
          "We close the accounts of members who repeatedly infringe copyright.",
          "Knowingly misrepresenting that material infringes, or that it was removed by mistake, can make you liable for damages under the DMCA, so please be sure before you send a notice or counter-notice.",
        ],
      },
    ],
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
