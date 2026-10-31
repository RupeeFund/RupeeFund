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
- **Headings.** `display` is only for the h1 of the home page. `page-title` is the h1 of each other page. `section-title` is each section h2 and the home page tagline. Add `heading` to a `p` that must look like a heading.
- **Body size** is `text-sm`. The theme in `packages/ui/src/styles.css` changes the Tailwind scale.
- **Prose.** Put the text from the content manager in `.prose`. Put each style of the HTML from `src/content/html.ts` in `packages/ui/src/styles.css`.
- **Row links.** A blog row is one link: `row-link` on the title. Its hover shows no line, because the pointer crosses many rows.
- **Buttons.** Use `btn` with `btn-primary` or `btn-quiet`. Add `btn-on-white` to a quiet button on a white surface. Set the size or the state with a modifier from `packages/ui/src/styles.css`, not with utilities in the markup.
- **Links.** Add `inline-link-ink` to an inline link on a `bg-brand` surface.
- **State.** Style a UI state from an attribute, such as `aria-pressed`. Do not set classes from JavaScript.
- **Admin panel.** Put the styles that only the panel uses in `apps/admin/src/admin.css`: the sidebar, the tables, the status marks and the chart. Take each colour from a brand token. Do not write a colour value.
- **Season accents** are `SEASONS` in `src/components/site/constants.ts`. `src/lib/launch.test.ts` checks their contrast.
- **Pixel art and brand files.** The [Illustration section](https://brand.rupeefund.org/#illustration) gives the art rules and the palette. `pnpm brand:sync` writes the files that `apps/web/scripts/brand-sync.mts` lists, the sprites included. `docs/ARCHITECTURE.md` section 9 gives the rules.
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

After the build, `src/build/og.ts` writes `/og/site.png`, the card for every page. The cards are [ogimagecn](https://ogimagecn.com) blocks in `src/components/og/`. To add a block, run `pnpm dlx shadcn@4.21.0 add @ogimagecn/<name>`. Then make its colours, type and logo agree with the brand rules.
