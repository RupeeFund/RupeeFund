# Design

The brand guidelines at [brand.rupeefund.org](https://brand.rupeefund.org) and the repository [RupeeFund/brand](https://github.com/RupeeFund/brand) own the look and the words. Read them before you change a page, and build what they say.

This file holds only what this repository adds. A component, a layout, a state or a class that only this repository uses goes in [Change the look](#change-the-look). Here, `src/` means `apps/web/src/`.

## Change the guidelines first

When the site needs a brand rule that the guidelines do not have, or must depart from one, change `RupeeFund/brand` first, in the same piece of work. Then build the rule here. A brand rule is a colour, a typeface, the logo, a word rule, or an interface rule for all surfaces. For example:

- A new colour: add it to the Colour section. After it reaches `main`, run `pnpm brand:sync` here.
- A word rule, such as how to write a percentage: add it next to Money and Dates in the Voice section.
- A dark ground on a public page: first change the Interface rule that public pages are light.

## Change the look

Change the look only for a defect, a brand rule or a request from a maintainer. The live site is the baseline. A finding from an audit, a review or a design panel is not a request: report it to a maintainer.

Show before you build:

1. Render two or three options of the change at the maintainer's screen width and at 360 px, side by side.
2. Let the maintainer choose one. Then write the code.
3. Use a number from research, a guide or a review only to make the options. It is not a rule.

A test checks defects only: overflow, clipped text at 320 px, contrast, focus, and a home card list that scrolls sideways on a phone. Do not write a test that holds a look, such as a column width or a count of characters in a line.

A new page uses the layout of its type:

| Type                          | Layout                                                                |
| ----------------------------- | --------------------------------------------------------------------- |
| Home                          | Its own grid, for the home page only.                                 |
| Signup form, `/subscribe`     | The form and its aside, in two columns.                               |
| People and FAQ                | The full frame, one column. A list of cards can use two.              |
| Short notices, such as `/404` | The full frame, one column.                                           |
| Legal pages and blog posts    | The title and the text in `reading`.                                  |
| Blog index                    | `src/components/site/PostList.astro`, in `reading`. Do not use cards. |
| Label row                     | `src/components/site/PostLabel.astro`.                                |

- **Layout** is not a brand rule. The pages in `src/pages/` and the frames in `src/layouts/` hold it. Content manager pages use `src/components/site/` and `src/components/people/`. The home page and the people page use the sections in `src/components/home/` and `src/components/people/`. `docs/ARCHITECTURE.md` section 11 tells where their words are.
- **Styles.** Reuse a class from `packages/ui/src/styles.css` before you add one. Put a new class in that file.
- **Headings.** The h1 of the home page uses `poster-figure`, sized to fill the width. `poster-page-title` is the h1 of each other page. `poster-heading` is each section h2 of the home page, except the pledges h2, which uses `poster-title`. `poster-subheading` is each section h2 of another page, and `poster-intro` is the short text under it. Add `heading` to a `p` that must look like a heading.
- **Type sizes.** Use the five sizes of the theme in `packages/ui/src/styles.css`: `text-xs` for labels, `text-sm` for body text, then `text-lead`, `text-section` and `text-title`. On a computer they are 13.4, 17, 27.5, 44.5 and 72 px: from the body text up, each size is 1.618 times the size below it. On a phone they are 13.4, 17, 21.6, 35 and 44.5 px, each a power of 1.272 times 17 px. Do not add a size between them. These exceptions fit their frame:
  - A home section h2 starts at 35 px, and the home tagline starts at 27.5 px.
  - A post title stops at 56.6 px.
  - A card title in a home grid shrinks below `text-lead` to fit its card.
  - The home name, the pledges h2 and the pledge figures grow to fill their width.
  - Buttons keep the sizes of `btn-lg` and `btn-xl`.
  - The text of a post or a legal page in `reading` uses `--text-reading`: 17 px on a phone and 21.6 px on a computer.
- **Labels.** Put `label` and `text-xs` on a short label, such as a nav link, a tag or the name of a figure. It is Inter Semibold, in sentence case. Do not set a label of the site in capitals. The admin panel keeps `eyebrow`.
- **Phone screens.** On a phone, stack the steps and the reasons of the home page. Do not make a row of cards scroll sideways.
- **Forms.** Put `form-poster` on a form of the site. It makes each field and choice square, with a 2 px ink border. The admin panel keeps the plain `field`.
- **Body size** is `text-sm`. The theme in `packages/ui/src/styles.css` changes the Tailwind scale.
- **Prose.** Put the text from the content manager in `.prose`. Put each style of the HTML from `src/content/html.ts` in `packages/ui/src/styles.css`.
- **Row links.** A blog row is one link: `row-link` on the title. Its hover shows no line, because the pointer crosses many rows.
- **Buttons.** Use `btn` with `btn-primary` or `btn-quiet`. Add `btn-on-white` to a quiet button on a white surface. Put `on-green` on a brand green surface: its focus ring is ink and its primary button lifts over white. Set the size or the state with a modifier from `packages/ui/src/styles.css`, not with utilities in the markup.
- **State.** Style a UI state from an attribute, such as `aria-pressed`. Do not set classes from JavaScript.
- **Admin panel.** Put the styles that only the panel uses in `apps/admin/src/admin.css`: the top bar, the tables, the status marks and the chart. Take each colour from a brand token. Do not write a colour value.
- **Season accents** are `SEASONS` in `src/components/site/constants.ts`. `src/lib/launch.test.ts` checks their contrast.
- **Icons.** Draw each icon in `src/components/site/Icon.astro`, as a thick line in `currentColor`. A season icon takes its season accent. Do not add pixel art.
- **Brand files.** `pnpm brand:sync` writes the colours, the logo and the files made from the logo, as `apps/web/scripts/brand-sync.mts` lists. `docs/ARCHITECTURE.md` section 9 gives the rules.
- **Visual check.** Check each visual change in a browser at 360 × 640 and at 1440 × 900, with and without reduced motion.

## Pages

- To add a page in code, write a `.astro` file in `src/pages/` and add an entry to `src/lib/seo.ts`. Without the entry, the page answers 500. A content manager page needs no entry.
- To rename a page, add a `302` line from the old path to `apps/web/public/_redirects`.
- A page must work with no JavaScript. The one exception is the signup form on `/subscribe` (`docs/ARCHITECTURE.md` section 4).
- Put page behaviour in `src/scripts/<page>.ts`, with a test beside it.

## Words

- Write the words on the site in the Voice of the brand guidelines, not in ASD-STE100.
- A FAQ answer can hold several paragraphs, bold and italics (`.faq-answer` in `packages/ui/src/styles.css`).
- Change the words of the pages at `rupeefund.org/admin` (`docs/EDITING.md`), not in the code. `docs/ARCHITECTURE.md` section 11 names the exceptions.
- The test of the seed content fails on a figure in an FAQ answer without a source. The live site does not check it.

## Link preview cards

After the build, `apps/web/og/og.ts` writes `/og/site.png`, the card for every page. Keep the card code out of `src/`: the dev server scans `src/` and cannot load the native image renderer that the card uses.
