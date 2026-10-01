# Design

The brand guidelines at [brand.rupeefund.org](https://brand.rupeefund.org) and the repository [RupeeFund/brand](https://github.com/RupeeFund/brand) are the source of truth for the look and the words of The Rupee Fund. Read them before you change a page. Build what they say.

This file holds only what this repository adds to them. A person or an agent can follow it. The site is in `apps/web`, so `src/` in this file means `apps/web/src/`.

## Change the guidelines first

Change the guidelines first in these cases:

- The site needs a rule that the guidelines do not have.
- The site must depart from a rule of the guidelines.

Make the change in `RupeeFund/brand`, in the same piece of work. The guidelines page is `src/pages/index.astro` in that repository. Then build the rule here.

Examples:

- The site needs a new colour. Add it to the Colour section in `RupeeFund/brand`. After the change reaches `main`, run `pnpm brand:sync` here.
- A page needs a component that the Interface section does not describe, for example a table. Add the rule to the Interface section. Then build the component here.
- A page needs a word rule that the Voice section does not have, for example how to write a percentage. Add the rule next to Money and Dates in that section.
- A public page needs a dark ground. The Interface section says that public pages are light. Change that rule first.

## Change the look

Change the look only for a defect, for a brand rule or for a request from a maintainer.

- **Layout.** Page layout is not a brand rule. The page files in `src/pages/` and the frames in `src/layouts/` hold it.
- **Columns.** An inner page puts its text in one column across the page, with no width cap. Only the home page, the signup form and a list of cards use more than one column.
- **Styles.** `packages/ui/src/styles.css` builds the brand rules that the brand files do not hold: the type scale and the classes for links, buttons, cards and forms. The site and the admin panel both use it. Reuse a class before you add one. Put a new class in that file.
- **Body size.** `text-sm` is the body size, 17 px. The theme in `packages/ui/src/styles.css` changes the Tailwind scale.
- **Buttons.** A button is `btn` with `btn-primary` or `btn-quiet`. Add `btn-on-white` to a quiet button on a white surface. Set its size or its state with a modifier from `packages/ui/src/styles.css`, not with utilities in the markup. `btn-icon` makes a square icon button. `btn-toggle` fills a button that has `aria-pressed="true"`.
- **State.** Style a UI state from an attribute, for example `aria-pressed`. Do not set classes from JavaScript.
- **Admin panel.** `apps/admin/src/admin.css` adds the styles that only the admin panel uses: the sidebar, the tables, the status marks and the chart. Take each colour from a brand token. Do not write a colour value.
- **Season accents.** `SEASONS` in `src/lib/launch.ts` holds them. `src/lib/launch.test.ts` keeps white text on each accent at 4.5:1.
- **Brand files.** `pnpm brand:sync` writes them. Do not edit them by hand. [ARCHITECTURE.md](ARCHITECTURE.md) section 9 lists them.
- **Visual check.** Check each visual change in a browser at 360 × 640 and 1440 × 900, with and without reduced motion.

## Pages

To add a page, write a `.astro` file in `src/pages/` and add an entry to `src/lib/seo.ts`. The build fails without the entry. To rename a page, add a `302` line from the old path to `apps/web/public/_redirects`. The page must work with no JavaScript. Put page behaviour in `src/scripts/<page>.ts` with a test beside it.

## Words

Each question on `/faq` is a Markdown file in `src/content/faq/`. `src/content.config.ts` gives its fields. Set `home: true` to show the question on the home page too. Give a source for each figure in an answer. The build test fails on a figure without one.

## Link preview cards

The build renders each link preview card to a PNG under `/og/`. `src/pages/og/site.png.ts` is the card for every page. The cards are [ogimagecn](https://ogimagecn.com) blocks in `src/components/og/`. To add a block, run `pnpm dlx shadcn@4.21.0 add @ogimagecn/<name>`. Then change its colours, type and logo to the brand rules.
