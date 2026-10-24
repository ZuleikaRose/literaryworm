export interface LegalPage {
  slug: string;
  title: string;
  summary: string;
}

/** Footer pages. Each is a placeholder until legal provides final copy. */
export const legalPages: LegalPage[] = [
  {
    slug: "accessibility",
    title: "Accessibility Policy",
    summary:
      "BookWorm aims to meet WCAG 2.2 AA. Use the accessibility menu in the header to change text size, font, contrast and motion. Press ? on any page to see keyboard shortcuts.",
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    summary: "What we collect, why we collect it, how long we keep it, and how to download or delete it.",
  },
  {
    slug: "privacy-choices",
    title: "Your Privacy Choices",
    summary: "Opt out of non-essential cookies and of any sale or sharing of personal information. Global Privacy Control is honored.",
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
