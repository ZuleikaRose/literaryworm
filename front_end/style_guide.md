# BookWorm style guide

The visual language comes from the Figma wireframe in `BookWorm_web_app_wireframe/`. It is implemented as CSS custom properties in `bookworm-app/src/styles/tokens.css`. Components use tokens, never raw hex values (the drawn book covers are the one exception: each title carries its own palette).

**Character:** a late-night reading room. Dark, warm and quiet, so the book covers carry the color. One warm accent (terracotta) marks what you can act on.

---

## Color

### Dark theme (default)

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#0b0d0f` | Page background |
| `--bg-deep` | `#090b0d` | Footer |
| `--surface` | `#111416` | Cards, sections |
| `--surface-raised` | `#181c1e` | Popovers, modals, auth card, inputs on cards |
| `--surface-high` | `#232729` | Chips, selected segments |
| `--field` | `#0e1112` | Text inputs |
| `--line` | `#292d30` | Dividers, card borders |
| `--line-strong` | `#3a3e40` | Input and secondary-button borders |
| `--ink` | `#f6f1e8` | Main text |
| `--cream` | `#eee5d4` | Display headlines |
| `--ink-soft` | `#d6d3cc` | Secondary text that must stay readable |
| `--muted` | `#a3a7a9` | Supporting copy |
| `--faint` | `#868b8e` | Placeholders, fine print |
| `--rust-bright` | `#d47652` | Accent: primary buttons, active nav, focus ring, eyebrows |
| `--rust-hover` | `#e1825e` | Primary button hover |
| `--rust-deep` | `#633421` | "On" state of a toggled primary button (e.g. Saved) |
| `--rust-wash` / `--rust-ink` | `#3a241c` / `#efb095` | Icon circles, avatar default |
| `--star` | `#d99154` | Rating stars |
| `--danger` / `--danger-wash` | `#e5766b` / `#3a1d1b` | Errors, danger zone |
| `--success` | `#8cc59a` | Confirmations |

`--muted` and `--faint` are slightly lighter than the wireframe's greys so small text passes WCAG AA contrast.

### Light theme

Chosen in the accessibility menu. Background `#f3f1ed`, surfaces white, ink `#1b1c1d`, accent darkened to `#a8502f` so white text on it passes AA. All other tokens have light equivalents in `tokens.css`.

### High contrast

Raises `--muted`, `--faint` and line colors toward the ink color and thickens the focus ring.

### Rules

- One accent. Terracotta appears on the main action, the active nav item, focus rings and small labels, not as decoration.
- Separate surfaces with a step in tone (`--bg` → `--surface` → `--surface-raised`) before reaching for a border.
- Text on photographs or covers is never needed: titles are always repeated in text next to a cover.

---

## Typography

| Role | Face | Notes |
| --- | --- | --- |
| Display and headings | **Manrope** 600–800 | Tight tracking (−0.03 to −0.05em), leading 0.98–1.1 |
| Interface and body | **DM Sans** 400–700 | Leading 1.5–1.7 |
| Reading (ebook reader) | **Literata** | For long-form text in the reader |
| Dyslexia-friendly mode | **Lexend** | Replaces all three when the accessibility setting is on |

Scale (rem; 1rem = 16px, multiplied by the text-size setting):

| Use | Size |
| --- | --- |
| Hero headline | `clamp(2.8rem, 5.3vw, 4.625rem)` |
| Page title | `clamp(2rem, 4.4vw, 3.25rem)` |
| Section title | 1.5625rem (25px) |
| Card / book title | 0.8125rem, Manrope 700 |
| Body | 0.875–1rem |
| Labels, hints, fine print | 0.75–0.8125rem (never below 12px) |
| Eyebrow | 0.6875rem, 700, +0.16em tracking, uppercase, terracotta |

- Headlines use `text-wrap: balance`; paragraphs use `text-wrap: pretty`.
- Keep running text under about 70 characters per line.
- Eyebrows sit above section titles, as in the wireframe. Use them only where they add context (a step number, a category), not on every block.

---

## Layout

- **Content width:** 1320px max, side gutter `clamp(16px, 5vw, 64px)`.
- **Header:** 76px tall (64px on phones), sticky, blurred background.
- **Section spacing:** `clamp(64px, 8vw, 104px)` between sections; 22px between a section title and its content.
- **Book rows:** 6 columns on desktop, 4 under 900px, and a horizontal scroll with snap under 560px.
- **Breakpoints:** 900px (tablet: nav collapses), 720px (phone: bottom tab bar, fixed popovers), 480px (small phone).
- **Phones:** no sideways page scroll. Only book rows scroll horizontally.

---

## Shape and depth

| Token | Value | Use |
| --- | --- | --- |
| `--radius-sm` | 7px | Header buttons |
| (buttons) | 8px | Primary, secondary, inputs |
| `--radius` | 10px | Cards, alerts |
| `--radius-lg` | 14px | Auth card, plan cards, modals |
| Book cover | 4px 10px 10px 4px | Spine on the left |
| `--shadow-float` | `0 30px 90px #000000c7` | Only on things that float: popovers, dialogs, auth card |

---

## Components

**Buttons.** Primary: terracotta fill, dark text, 44px minimum height. Secondary: raised surface with a strong border. Ghost: text only. Danger: red text on a red wash. Text button: terracotta link style. Every button scales to 0.97 when pressed. Label buttons with what they do ("Create account", "Start Standard for $12.99/month"), not "Submit".

**Fields.** Visible label above the input, hint below. On error the hint is replaced by a red message with an alert icon, the border turns red, and `aria-describedby` points at the message. After the first submit, errors update as the person types. Passwords have a Show/Hide toggle.

**Book cover.** Drawn in CSS: a palette (ground, ink, accent) plus one motif (dot-slash, sun, horizon, slash, rings, band, stripe, arch, grid, wave), an inner frame and a spine line. Sizes: `sm` 96px, `md` (fills its column), `lg` 210px, `xl` 250px. Cover text scales with the cover using container query units.

**Book card.** Cover, then title (Manrope), author, star rating; optional progress bar on the cover. Lifts 6px on hover (pointer devices only).

**Popovers.** Accessibility menu and profile menu: raised surface, floating shadow, open with a short scale-and-fade, close on Escape (focus returns to the button) or outside click. Full-width under the header on phones.

**Alerts.** Error: red border and wash, `role="alert"`. Success: green border and wash, `role="status"`.

---

## Motion

- Durations: 140ms (hover, press), 220ms (popovers, toggles), 420ms (panels appearing).
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` for things entering.
- One orchestrated moment per page at most (the landing hero covers settle into their fan).
- Motion answers an action: opening, toggling, confirming. No scroll-triggered fades on every section.
- `prefers-reduced-motion` and the *Stop animations* setting both turn motion off.

---

## Accessibility

- Target WCAG 2.2 AA. Lighthouse accessibility score of 100 on every page.
- Visible focus ring (2px terracotta, 3px in high contrast) on every interactive element.
- Touch targets at least 44×44px.
- Every icon is decorative (`aria-hidden`) and every icon-only button has a text label.
- *Skip to content* link; page titles change per route.
- Covers are decorative; the title and author are always in text.

---

## Voice

- Plain verbs, sentence case, no exclamation marks.
- Errors say what happened and how to fix it, without apologizing: "Use at least 15 characters. A short phrase works well."
- Never reveal whether an email has an account.
- Money and renewal terms are stated in full before anyone confirms.
