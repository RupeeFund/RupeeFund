# Design

The brand guidelines at [brand.rupeefund.org](https://brand.rupeefund.org) and the repository [RupeeFund/brand](https://github.com/RupeeFund/brand) own the look and the words of The Rupee Fund. Read them before you change a page. Build what they say.

This file holds only what this repository adds to them. The site is in `apps/web`, so `src/` in this file means `apps/web/src/`.

The guidelines do not record each component and detail of this repository. That gap is intentional. A brand rule goes in the guidelines. A component, a layout, a state or a class that only this repository uses goes in [Change the look](#change-the-look).

## Change the guidelines first

Change the guidelines first in these cases:

- The site needs a brand rule that the guidelines do not have. A brand rule is a colour, a typeface, the logo, a word rule, or an interface rule for all surfaces.
- The site must depart from a rule of the guidelines.

Make the change in `RupeeFund/brand`, in the same piece of work. Then build the rule here.

Examples:

- The site needs a new colour. Add it to the Colour section in `RupeeFund/brand`. After the change reaches `main`, run `pnpm brand:sync` here.
- A page needs a word rule that the Voice section does not have, for example how to write a percentage. Add the rule next to Money and Dates in that section.
- A public page needs a dark ground. The Interface section says that public pages are light. Change that rule first.

## Change the look

Change the look only for a defect, for a brand rule or for a request from a maintainer. The live site is the baseline. A finding from an audit, a review or a design panel is not a request. Report it to a maintainer.

- **Layout.** Page layout is not a brand rule. The page files in `src/pages/` and the frames in `src/layouts/` hold it. The components in `src/components/site/` hold the layout of each page that the content manager fills.
- **Page types.** Each type of page has its own layout rule. Use the rule of the type when you add a page.
  - Home: its own grid. Only the home page uses it.
  - Signup form, `/subscribe`: the form and its aside, in two columns.
  - People and FAQ: the full frame, in one column. A list of cards can use two columns.
  - Legal pages and blog posts: long text. Put the title and the text in `reading`, one column at the centre of the frame, `max-w-measure` (48 rem) wide.
  - Blog index: in `reading`, the title, a lede and the RSS link, then one row for each post, with a line between rows. A row has the label row, the title, the excerpt and a `post-thumb` image at the right. Do not use cards.
  - Blog post: a link back to the index, the label row, the title, the excerpt as the lede, the byline row, the lead image across the column with its caption, and the text.
  - Label row (`PostLabel.astro`): the kind of post in `eyebrow` deep green, and the season pill in the accent of the season. The post page adds the season sprite. A row on the index adds the date and the reading time.
  - Byline row: the authors from the content manager, or "The Rupee Fund volunteers", then the date, the updated date if it is a later day, and the reading time.
  - Short notices, for example `/404`: the full frame, in one column.
- **Styles.** `packages/ui/src/styles.css` builds the brand rules that the brand files do not hold. It holds the type scale and the classes for links, buttons, cards and forms. The site and the admin panel both use it. Reuse a class before you add one. Put a new class in that file.
- **Headings.** `packages/ui/src/styles.css` holds three heading sizes. `display` is only for the h1 of the home page. `page-title` is the h1 of each other page of the site. `section-title` is each section h2 and the tagline of the home page. Add `heading` to a `p` that must look like a heading.
- **Body size.** `text-sm` is the body size. The theme in `packages/ui/src/styles.css` changes the Tailwind scale.
- **Prose.** Put the text from the content manager in `.prose`. It sets the spacing, the headings, the lists, the quotes, the code, the tables, the dividers and the images. An image is at the centre of the column, with its caption under it. An h1 from the editor shows as an h2, because the page title is the h1. The site does not show an embed, raw HTML, a gallery or a reference (`docs/ARCHITECTURE.md` section 11.1). Put each style of the HTML that `src/content/html.ts` makes in `packages/ui/src/styles.css`, so the prose styles stay in one file.
- **Row links.** A blog row is one link. The title is `row-link`, and its overlay covers the row. On hover, the title turns deep green in 150 ms, with no line, because the pointer crosses many rows.
- **Buttons.** A button is `btn` with `btn-primary` or `btn-quiet`. Add `btn-on-white` to a quiet button on a white surface. Set its size or its state with a modifier from `packages/ui/src/styles.css`, not with utilities in the markup. `btn-icon` makes a square icon button. `btn-toggle` fills a button that has `aria-pressed="true"`.
- **Links.** Add `inline-link-ink` to an inline link on a `bg-brand` surface. It sets the text, the line and the focus ring to ink.
- **State.** Style a UI state from an attribute, for example `aria-pressed`. Do not set classes from JavaScript.
- **Admin panel.** `apps/admin/src/admin.css` adds the styles that only the admin panel uses: the sidebar, the tables, the status marks and the chart. Take each colour from a brand token. Do not write a colour value.
- **Season accents.** `SEASONS` in `src/components/site/constants.ts` holds them. `src/lib/launch.test.ts` keeps white text on each accent at 4.5:1.
- **Brand files.** `pnpm brand:sync` writes them. Do not edit them by hand. `apps/web/scripts/brand-sync.mts` lists them.
- **Visual check.** Check each visual change in a browser at 360 × 640 and at 1440 × 900. Check it with and without reduced motion.

## Pages

To add a page in code, write a `.astro` file in `src/pages/` and add an entry to `src/lib/seo.ts`. Without the entry, the page answers 500. A page that the content manager holds needs no entry. To rename a page, add a `302` line from the old path to `apps/web/public/_redirects`. The page must work with no JavaScript. The one exception is the signup form on `/subscribe`, because its bot check needs JavaScript. `docs/ARCHITECTURE.md` section 4 tells why. Put page behaviour in `src/scripts/<page>.ts` with a test beside it.

## Words

Write the words on the site in the Voice of the brand guidelines. Do not use ASD-STE100 for them. That grammar is for the documents only.

A FAQ answer can hold several paragraphs, bold and italics. `.faq-answer` in `packages/ui/src/styles.css` spaces the paragraphs and sets bold text in ink. The site loads the italic Inter for `em`.

The content manager holds the words of the landing page, the blog, the pages, the FAQ, the people page and the menus. Change them at `rupeefund.org/admin`, not in the code. `docs/ARCHITECTURE.md` section 11 tells how. Tick **Show on the home page** to show a question on the home page too. Give a source for each figure in an answer. The test of the seed content fails on a figure without one. The live site does not check it, so check each figure before you publish.

## Link preview cards

The build renders each link preview card to a PNG under `/og/`. `src/build/og.ts` writes `/og/site.png`, the card for every page, after the build. The cards are [ogimagecn](https://ogimagecn.com) blocks in `src/components/og/`. To add a block, run `pnpm dlx shadcn@4.21.0 add @ogimagecn/<name>`. Then make its colours, type and logo agree with the brand rules.
