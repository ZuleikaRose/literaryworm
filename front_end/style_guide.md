# LiteraryWorm style guide

The visual language comes from the Figma wireframe in `BookWorm_web_app_wireframe/`. It is implemented as CSS custom properties in `literaryworm_app/src/styles/tokens.css`. Components use tokens, never raw hex values (the drawn book covers are the one exception: each title carries its own palette).

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

**Book tile (Google Books).** Same layout as the book card, with Google's cover image (https only, lazy-loaded, `alt=""` because the title is repeated) or, when there is none, a drawn cover picked from the catalog's palettes by the book's id. Shows the published year instead of a rating.

**Home row (shelf).** Heading on the left; *See all* and two 44px arrow buttons on the right. Scrolls left and right only (arrows, swipe, or Tab through the books), with the row bleeding to the screen edge. Rows from the books service end with a dashed *Load more* card. Top 10 puts a large outlined rank number beside each cover.

**Keep discovering (feed).** Genre links as 44px pill buttons (current genre filled terracotta, `aria-current="page"`), a "N books loaded" count, then the cover grid. More books load as the reader nears the bottom; a *Load more books* button does the same. States: shimmer skeletons on first load, an error panel with *Try again* (keeps the books already loaded), *No books here yet*, and *That's everything in …* at the end.

**Featured carousel.** Copy on the left (eyebrow, large title, byline, three-line synopsis, primary button), cover on the right. Controls: Pause/Play, Previous, dots, Next, all 44px. Advances every 7 seconds; stops while hovered or focused; starts paused when motion is reduced.

**Popovers.** Accessibility menu and profile menu: raised surface, floating shadow, open with a short scale-and-fade, close on Escape (focus returns to the button) or outside click. Full-width under the header on phones.

**Alerts.** Error: red border and wash, `role="alert"`. Success: green border and wash, `role="status"`.

---

**Book details hero.** Cover (250px, 200px on phones) beside the info column: eyebrow (first category · year), display title, subtitle, byline, a meta row split by thin rules (gold star rating, ratings, pages, logs), the description, then actions and a small lock-icon privacy note. Stacks on phones with the cover centred.

**Reading status.** Once a book is saved, the primary button becomes a native `<select>` dressed as a rust-tinted button (bookmark icon, chevron), so the status stays one control that works with any input.

**Rating buttons.** Pill toggles (44px) with `aria-pressed`: Not for me, I like this, I love this, Favorite. The pressed state uses the rust wash, never color alone (the icon fills too).

**Log card.** Avatar initials, display name (with a *You* tag on your own), date, optional five gold stars (`role="img"`, "Rated 4 out of 5"), body in the reading serif. Long logs clamp to five lines with *Read full log*. Your own logs get a rust border and Edit and Delete.

**Search page.** A large labelled search field (52px) with *Search* and *Surprise me* beside it and a one-line hint ("titles only"). Results are two titled sections, *From LiteraryWorm* then *From Google Books*. Filters are radio chips grouped under small headings (Show, Genre, Sort by) in a sticky 240px sidebar; below 900px they move into a *Filters* dialog opened by a button that counts active filters.

**Did you mean.** One line on the surface color with a rust left rule; the suggestion is a bold rust link that runs the corrected search.

**Library page.** Section links under the title (My library, Favorites, Lists) with a rust underline on the current one. Library rows: small cover, title link, author and the date added, then a compact status menu and *Remove*; on phones the controls wrap under the title. Status filters are radio chips with counts.

**Custom list card.** Name, description and book count on the surface color, with Move up / Move down (44px icon buttons, disabled at the ends), Share, Rename and Delete; books are a simple list with a remove button, and *Add a book from your library* below. A shared list shows a small green *Shared* tag beside its name (with a link icon, not colour alone).

**Share dialog.** Says who can see the list and what they see, then the link in a read-only field with *Copy link* beside it (it confirms *Copied* for two seconds, announced to screen readers) and *Stop sharing* as a danger text button. Before the first share: one paragraph and a primary *Share by link*.

**Shared list page.** A public page in the site layout: eyebrow *Shared list*, the list's name as the page title, its description, "A list by Avery" and the book count, then the titles in the cover grid. A wrong or stopped link uses the empty-state pattern with *Explore LiteraryWorm*.

**Saving states.** Buttons that save to Supabase say what they're doing ("Adding…", "Saving your plan…", "Logging in…") and are disabled meanwhile; a failed save shows a plain-words alert beside the control and the screen doesn't change.

**Reader.** The page is the book, not the app: its own paper themes (light, sepia, dark; `--paper-*` tokens), Literata by default, a 32–44rem measure, indented paragraphs, and a rust drop capital that opens each chapter. Two thin bars, top and bottom, fade out (opacity and an 8px slide, none with reduced motion) after 4 seconds and come back on any input. All their controls are 44px.

**Progress bar with chapter marks.** A native range input, 44px tall, with a 6px track filled in the accent up to the current place and a small notch at each chapter start. Its value is spoken as "Page 16 of 84, Chapter 3" or "8 hours 37 minutes of 20 hours 33 minutes, Chapter 10".

**Player.** Cover beside the controls on desktop, stacked on phones. A 76px rust play button between 56px outlined ±15 buttons, with previous and next chapter beside them; Speed and Sleep timer are labelled native selects. The sleep timer's state reads as one line of rust text under them.

**Highlights.** Four colours, as `--mark-yellow`, `--mark-green`, `--mark-blue` and `--mark-pink` tokens set per paper theme so the text keeps its contrast on light, sepia and dark pages. A highlight is a soft background under the words, never a colour change of the text; one with a note also gets a dotted underline and a small note icon after it, so the difference doesn't rely on colour.

**Selection toolbar.** A dark floating bar above the selection (below it when there's no room): four 44px colour swatches with names for screen readers, then *Add note* and *Define*. It appears with a 140ms fade and scale from 0.96 and closes when the selection goes or on Escape.

**Notes and highlights list.** A dialog grouped by chapter: a colour bar on the left of each item, the words in the reading serif (clamped to three lines), the note below in the UI font, then *Go to page*, *Edit* and *Remove*.

**Dictionary.** A small dialog: the word in the display face with its pronunciation beside it, then meanings grouped by part of speech (an italic label), numbered definitions and examples in muted italic. A search field at the top looks up another word. The source credit sits at the bottom in small muted text.

**Voice list.** A native `<select>` beside Speed and Sleep timer, labelled *Voice*: *Original narrator: (name)* first for books with a LibriVox recording, then the device's voices in `<optgroup>`s by accent (British, American and Australian English), names without the vendor ("Libby", "Aria (online)"), then *No voice (silent sample)* for books without a recording. Capped at 300px so long names never push the page sideways. The note under the controls says who is reading and from what text.

**Summary.** A section on the book page between the actions and *Book details*: eyebrow *Written by AI*, heading *Summary*, then *Short* and *Detailed (spoilers)* as pill toggles (`aria-pressed`, the rating-button style). Nothing loads until one is chosen; while the first summary of a book is written, a muted line says it can take half a minute (`role="status"`). Paragraphs in a 72ch measure at 1.7 line height. A small credit underneath says Claude wrote it and it can contain mistakes. From a My Library row, a ghost *Summary* button (book icon) opens the same content in a dialog: the dialog carries the eyebrow and the title ("*Title*: summary"), and the short summary loads at once.

**Reader text.** Public-domain titles show their real text in whole paragraphs, about 1,600 characters a page; the note under the progress bar reads *Public-domain text from Project Gutenberg.* Other titles keep the sample-pages note.

**Another device.** A floating card under the reader's top bar, on the page's own paper colour: one sentence (*On another device you read to Chapter 12 (40%).*), a primary *Go there* and a ghost *Stay here*. Polite live region; nothing moves until the reader chooses.

**Ask the book.** A speech-bubble icon in the reader's tools (public-domain titles only) opens a dialog: eyebrow *Written by AI*, title *Ask the book*, a line saying answers come from the text up to the current chapter, a two-line question box and *Ask*. Answers stack newest first, the question in bold above its answer; a credit underneath says Claude can make mistakes.

**Goals.** My Library's *Goals* tab: cards on the raised surface. The goal card shows the count large in the display face (*11 of 24 books finished*), a thin rust progress bar and a pace line; the streak card a clock icon and the day count; then a full-width *Month by month* table (month, time, days read, books finished) that scrolls sideways on its own if a phone is too narrow.

**Clubs.** My Library's *Clubs* tab lists clubs as cards (small cover, name, book, members, finish date, today's chapter), then *Start a club* and *Join a club* cards. A club page has the cover beside its name and pace, *Read* and *Listen*, the discussion (chapter select, post box, posts newest first, spoilers replaced by an italic line with *Show it anyway*), and a side column with the invite code (*Copy*), members (*Started it* tag) and *Leave club* / *Delete club*, which asks first. On phones the side column drops below.

**Read offline.** A section on public-domain book pages after the summary: a status line, then ghost buttons *Save the text (small)*, *Save text and audio (about N MB)* / *Add the audio*, and *Remove from this device*. Progress replaces the status line (*Saving the audio: chapter 3 of 21…*).

**Read-along with real text.** The same transcript box; with a device voice on a public-domain title it shows the book's text, has no Language list (English only), and its note says the text is marked as the voice reads it.

**Read-along transcript.** Full width under the cover and controls, in a scrolling box on the surface colour, with *Follow the narration*, Language and Size beside its heading: the reading serif at three sizes (17, 20, 24px), the current sentence on the rust wash with a rust left rule, the rest at full ink. Each sentence is an inline target (button role) that jumps there, so the paragraphs keep their shape. It scrolls the current sentence into the middle smoothly (instantly with reduced motion).

**Mini-player.** A 64px bar fixed to the bottom of the page (above the tab bar on phones), up to 820px wide, raised surface with the floating shadow and a 2px rust progress line along its top edge (inset from the rounded corners): small cover, the book's title, then the chapter and the time left in it as "Chapter 10 · −43:57" or "3. The Ball · −4:12" (truncated), then *Previous chapter*, *Back*, a rust *Play/Pause*, *Forward*, *Next chapter*, the volume slider, *More* (three dots) and *Close*, all 44px. Below 1020px the volume moves into *More*; below 720px the chapter buttons do too. *More* opens a menu upward from the bar (full width of the bar on phones, scrolling inside the screen): a label naming the chapter, then the place controls, a rule, the four ways into *Go to*, a rule, and settings, another device and the full player. Controls that don't apply right now (*Skip intro* after the intro) stay in place, faded and disabled. It slides up 16px and fades in once when it first appears, and pages get bottom padding so it never covers content. It sits under the header and tab bar, so their menus open over it.

**Player place controls.** Under the play row of the full player, a centred row of rust text buttons: *Beginning* and *End* with double-arrow icons, *Skip intro* and *Skip outro*; one that doesn't apply turns faint and does nothing. Under them, a volume control: a mute icon button (its icon shows a cross when muted, `aria-pressed`) and a thin rust slider (4px track, 14px thumb, steps of 5%, read out as a percentage or "Muted"), at most 280px wide.

**Go to.** A dialog with the book's title as eyebrow and a segmented control (*Contents*, *Index*, *References*, *Time*; native radios, so the arrow keys move between them). Contents uses the chapter list. Index is a search field with a hint saying how accurate the times are, then results as two-line rows: the chapter and time in small muted type, then the words around the match with the match on the rust wash. References lists the credits and bookmarks by time, under a ghost *Bookmark Chapter 3, 4:12* button. Time is one field and *Go*; a time past the end says how long the book is.

**Listen on another device.** A small dialog: one sentence naming this device, then the account's open devices as rows (device icon, name, ghost *Send here*) and *Refresh*. After sending it says where the book went and that it paused here, with *Done*. On the receiving device a card appears above the mini-player (raised surface, floating shadow, at most 520px): the title in bold, where it came from and the time, then a primary *Listen here* with a headphones icon and a ghost *Not now*.

**Lock screen and install icons.** The lock screen shows the book's drawn cover as a square PNG (palette, the motif's main shape, title and author; `lib/coverArt.ts`). App icons are the favicon's tilted rust tile with the dark book glyph; the maskable and Apple icons fill the square in rust with the glyph inside the safe zone. *Install the app* is a row in Account → Preferences: bold label, a muted line saying what it does (or how to on Safari), and a secondary button with the download icon.

**Quote card.** A dialog, *Share a quote*, with the book's title as eyebrow, a *Look* segmented control (Book colours, Light, Dark), a 4:5 preview, then *Share* (primary, only where the device shares files), *Download picture* and a ghost *Copy the quote*. The card itself: a large rust (or muted) opening quotation mark, the quote in Literata as large as fits, and a footer with the drawn cover, the title in Manrope, author, chapter and literaryworm.com. Its image has the quote as alt text.

**Stats.** My Library's *Stats* tab: an eyebrow (*Avery's year in review*) and a display heading (*2026 in books*) with a Year select. Then tiles on the raised surface (rust icon, a large display number, a muted line), a reading/listening bar (rust for reading, rust ink for listening, with a legend in words), twelve month bars with short month names (full month and time for screen readers), top genres and authors as numbered lists, and the year's books as small covers with title and author.

**Club alerts and counts.** A club card with new posts shows a small rust pill, *2 new*, after its name. Alerts sit in the bottom-right corner (above the mini-player and tab bar): a raised card with the users icon, one sentence (*Ann posted in Gothic Nights about chapter 3.*), an *Open the club* link and a dismiss button; they go after nine seconds and never cover the reader or player. A club's *Notifications* card has a switch and, for members, a ghost button with the bell icon to allow background notifications.

**Listen together.** A card on the club page: who is leading and where (*Ann is playing Chapter 3 of 27*), then *Join* (primary, with the headphones icon) or *Start listening together*; a line warns when joining goes past your place. While in a session, a pill in the bottom-left corner says *You're leading* or *Listening along with* the club (linked), with *Stop* or *Leave*.

**Uploads.** My Library's *Uploads* tab: an *Add a book you own* card (a sentence on EPUB without DRM, privacy and rights, then a primary *Choose an EPUB* button that opens the file picker) and the uploads as library rows (drawn cover, title, author, parts, words, date and how far read, *Read* or *Continue*, and *Delete* with a confirmation). Kids profiles see the lock empty state instead.

**Legal pages.** Up to 760px wide: the title, a summary in a larger size, then, for a page written in full (the Cookie Policy), *Last updated* in muted text and sections, each with a display-face heading and paragraphs in soft ink at a generous line height. Pages still awaiting legal copy say *The full policy will be published here before launch.* Every legal page ends with links to the others, and all of them are in the footer.

**Editing a policy.** For editors and admins, a secondary *Edit page* button sits above the summary. The editor replaces the page in place: a one-line hint (changes go live; blank line between paragraphs; earlier versions kept), Title and Summary fields, then each section as a raised card with a heading field, a text area, and ghost *Move up*, *Move down* and red *Remove*; *Add a section* below; then *Save and publish* (primary) and *Cancel*. Problems show in one red line above the buttons, focused, naming the section. After saving, a green *Saved and published.* shows beside *Edit page*.

**Team access.** An Account section shown only to staff: *Your access* in bold, the six roles with one line each (the unused ones say so), and for admins *The team*: a ruled list of people (name and email, or the email and *invited, not signed up yet*) with each role as a pill holding a small remove button, then an Email field, an Access select and *Give access* on one row (stacked on phones).

**Account page.** Section links as 44px pills under the title. Each section is a row split by a thin rule: heading and one-line intro on the left (a third), controls on the right; stacked on phones. Plan facts sit in a 2×2 grid of cells divided by 1px lines, with a coloured dot for the status (green active, amber paused, red ending). Saves report beside their control with the success or error alert.

**Danger zone.** The last section, with a red rule and red heading: one paragraph that says what goes, then a red *Delete account* button that opens a small dialog (password, a confirmation tick, *Delete my account* / *Keep my account*).

**Mark as finished? and daily limit.** Small dialogs and full-screen messages use the empty-state pattern (icon in a rust circle, title, one sentence, actions). The finished state pops its check icon in once.

**Header on narrow phones.** The logo is the book mark plus the wordmark "Literary**Worm**" ("Worm" in rust). Up to 480px the wordmark is set at 1rem so the header still fits; below 390px it is hidden visually (not with `display: none`), so the logo link is still announced as "LiteraryWorm, home".

**Write a log dialog.** Native `<dialog>`: eyebrow *Public reading log*, a labelled textarea with a live character count (1–5000), rating as radio chips (No rating, 1–5), *Posting as* and *Publish log* (*Save changes* when editing). Errors sit under the field and are linked with `aria-describedby`.

## Motion

- Durations: 140ms (hover, press), 220ms (popovers, toggles), 420ms (panels appearing).
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` for things entering.
- One orchestrated moment per page at most (the landing hero covers settle into their fan).
- Carousel slides fade up 12px over 420ms; loading dots pulse; skeletons shimmer. All stop with reduced motion.
- Motion answers an action: opening, toggling, confirming. No scroll-triggered fades on every section.
- The mini-player rises in once (16px, 220ms); the selection toolbar fades and scales in (140ms); the transcript glides to the current sentence. None of these move with reduced motion.
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
