# Edit the site

The content manager at [rupeefund.org/admin](https://rupeefund.org/admin) holds the blog, the pages, the FAQ and the community team. You change the words, not the layout. For the words of the home page and the people page, or the header and footer links, ask a maintainer.

## 1. Sign in

1. Ask an admin to add your GitHub account to a team of the `RupeeFund` organization: `cms-authors` (Author), `cms-editors` (Editor) or `cms-admins` (Admin).
1. Accept the GitHub invitation to the organization, if one comes. Until then, the team does not count.
1. Open [rupeefund.org/admin](https://rupeefund.org/admin) and sign in with GitHub. The first time, authorize the app of The Rupee Fund.

- Two teams give the higher role.
- Your GitHub account needs a verified primary email address.
- A session ends after 8 hours, with no warning. Then you cannot save, and you lose each unsaved change. Save often.
- A team change takes effect at your next sign-in. To change your role, ask an admin.

## 2. What each role can do

Each role adds to the role before it.

- **Author:** write posts and normal pages, and upload images. Edit, publish, unpublish and delete your own.
- **Editor:** do the same to the posts, normal pages and images of others. Change the author or publish date of a post or a normal page, the categories and the bylines.
- **Admin:** edit, publish and unpublish the legal pages. Write, edit, publish, unpublish, delete and restore the FAQ and the community team. Empty the trash (a delete for good). Change the settings, the people and the API tokens. Download a backup.

The sample entries are not an Author's. For an entry of another person, ask an Editor.

Nobody can delete a legal page, import a site, move the site to another host, or change the fields of a collection in the content manager. An admin changes the fields with an API token.

## 3. Publish a change

1. Save the entry as a draft.
1. For a post or a page, click **Preview**. Other entries have none.
1. Click **Publish**.
1. Check the page at the next load. If it shows the old words after 1 minute, publish again.

To undo a change, restore an earlier revision and publish it. Each entry keeps its newest 50 revisions. Restore a deleted entry from the trash.

## 4. Take care

- Do not delete an image that an entry uses. The entry then shows a broken image.
- Do not change the slug of a published entry. The old address then stops.
- If you delete a category, its posts show Blog.

If the site leaves out an entry or shows an error page, read section 8, correct the entry and publish again. If you cannot find the problem, tell a maintainer.

## 5. Write a blog post

- **Title:** the heading and the name of the browser tab.
- **Excerpt:** one or two sentences under the title. The blog list, the RSS feed and search results also show it.
- **Category:** Blog or Article, above the title. With none, the post shows Blog.
- **Season:** optional. A label in the colour of the season. An empty **Season year** takes the year of the publish date.
- **Cover image:** optional. On the blog list and across the top of the post.
- **Body:** the text (section 6).
- **Bylines:** add each author. If the byline does not exist, ask an Editor to make it. With none, the post shows "The Rupee Fund volunteers".

The post shows its publish date, its reading time, and the date of an edit on a later day. Its address is `/blog/` and then its slug. Give each post a different slug. When the blog has one published post or more, the header and the footer link to the blog, and search engines can list it.

## 6. What the body can hold

- Paragraphs, each one idea.
- Heading 2 for a section, Heading 3 to Heading 6 inside it. The title is the only Heading 1, so a Heading 1 shows as a Heading 2.
- Lists, bulleted or numbered, also inside a list.
- Quotes, code blocks, tables, dividers and links.
- Images from the media library, with alt text and an optional caption.
- Bold, italic, code, underline, strike-through, subscript and superscript.
- A callout, a quote with the name of its speaker, and a call to action. Type `/` in the body to add one.

## 7. Images and words

- Upload each image to the media library first: PNG, JPEG, GIF, WebP or AVIF.
- Give each image alt text that tells what it shows, and its credit in the caption.
- Write in the Voice of the [brand guidelines](https://brand.rupeefund.org): plain words, short sentences.
- Give a source for each figure.

## 8. What the site refuses

The site leaves out an entry that holds:

- An embed, an HTML block, a gallery or a reference. Remove it.
- An SVG image, or an image outside the media library.
- A link that does not start with `https://`, `mailto:`, `/` or `#`. Change `http://` to `https://`.
- An empty callout, quote or call to action.
- A team photo not on GitHub. Use the GitHub profile photo address.
- A slug with a character other than a lowercase letter, a digit or a hyphen.

## 9. The other pages

- **FAQ:** a question, an answer and an order. A lower order shows first, and on a tie the oldest. To show a new entry last, give it a high order, such as 99. Tick **Show on the home page** to show it there too. A source is a title and an `https://` link.
- **Community team:** a name, an order (as in the FAQ), and an optional bio, profile URL, username and photo URL.
- **Pages:** the kind is a normal page or a legal page. The address is `/` and then the slug. To remove a legal page, an admin first changes its kind to normal.
