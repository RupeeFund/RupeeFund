# Edit the site

The content manager at [rupeefund.org/admin](https://rupeefund.org/admin) holds the words of the site: the landing page, the blog, the pages, the FAQ, the people page, the community team and the menus. The layout of each page stays the same. You change the words, not the structure.

## 1. Sign in

An admin sends you an invite link. Open it and make a passkey. Then sign in with that passkey. The site sends no email, so **Sign in with email link** does not work.

| Role   | What the role can do                                                                         |
| ------ | -------------------------------------------------------------------------------------------- |
| Author | Write entries. Edit, publish and delete your own entries.                                    |
| Editor | Edit, publish and delete each entry, except the landing page and a legal page.               |
| Admin  | All of the above. Edit the landing page and the legal pages. Invite and remove other people. |

## 2. Publish a change

1. Save the entry as a draft.
1. For a post or a page, click **Preview**. The preview shows the draft in the layout of the site. For the other entries, **Preview** opens a page that does not exist. Use the edit mode of section 3 to see their drafts on the page.
1. Click **Publish**. The content manager does not publish at a set time, and it refuses a schedule.

The site shows the change at the next page load.

If the site refuses an entry, it leaves the entry out. A refused post or page does not show at all. A refused landing page or people page shows an error page in its place. So check the page after each publish. Section 6 lists what the site refuses. If you cannot find the problem, tell a maintainer.

To undo a change, open the entry, restore an earlier revision and publish it.

## 3. Edit on the page

When you are signed in, each page of the site shows an **Edit** button. Click it to turn on the edit mode. The page then shows the drafts. Click a title or a short text, and change it in place. Click an image to select a different one. Change the body and the other fields in the content manager.

An editor sees no fields to edit on the landing page and on a legal page, because only an admin can change them.

## 4. Write a blog post

| Field       | What it does                                                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title       | The heading of the post and the name of the browser tab.                                                                                             |
| Excerpt     | One or two sentences under the title. The blog list, the RSS feed and search results also show it.                                                   |
| Category    | The label above the title: Blog or Article.                                                                                                          |
| Kind        | The old label. The site shows it only when the post has no category.                                                                                 |
| Season      | Optional. A label in the colour of the season.                                                                                                       |
| Season year | The year of the season. If you leave it empty, the site uses the year of the publish date.                                                           |
| Cover image | Optional. It shows on the blog list and across the top of the post. Give it alt text that tells what the image shows. Put the credit in the caption. |
| Body        | The text of the post. Section 5 tells what it can hold.                                                                                              |

Add each author as a byline. A post with no byline shows "The Rupee Fund volunteers".

The post shows its publish date and its reading time. If you edit a post on a later day, it also shows the date of the edit.

The address of the post is `/blog/` and then its slug. Give each post a different slug. Do not change the slug after you publish, because the old address then stops.

## 5. What the body can hold

- Paragraphs. Make each paragraph one idea.
- Headings. Use Heading 2 for a section, and Heading 3 to Heading 6 in a section. The title of the post is the only Heading 1, so the site shows a Heading 1 as a Heading 2.
- Bulleted and numbered lists. A list can hold a list.
- Quotes, code blocks, tables and dividers.
- Images from the media library, with alt text and an optional caption.
- Bold, italic, code, underline, strike-through, subscript and superscript.
- Links.
- A callout, a quote with the name of the person who said it, and a call to action. Type `/` in the body to add one.

## 6. What the site refuses

The site leaves an entry out when the entry has one of these problems:

- An embed, an HTML block, a gallery or a reference. Remove the block.
- An image that is not in the media library. Upload the image first. Use PNG, JPEG, GIF, WebP or AVIF. Do not use SVG.
- A link that does not start with `https://`, `mailto:`, `/` or `#`. Change `http://` to `https://`.
- A callout, a quote or a call to action with no text.
- A team photo that is not on GitHub. Use the address of the GitHub profile photo.
- A heading, a list or a quote in the pitch text of the landing page. Use plain paragraphs.
- More than one paragraph in a step of the landing page, or in the foundation text of the people page.
- A slug with a character that is not a lowercase letter, a digit or a hyphen.

## 7. The other pages

- **FAQ.** Each entry has a question, an answer and an order. A lower order shows first. Entries with the same order show the oldest first, so give a new entry a high order, such as 99, to show it last. Tick **Show on the home page** to show the entry there too. A source is a title and an `https://` link.
- **Landing page** and **People page.** Each is one entry. Change its words. Do not make a second entry. Only an admin can change the landing page.
- **Community team.** Each person has a name, an order and an optional bio, profile URL, username and photo URL. The order works as in the FAQ.
- **Pages.** A page has a kind: a normal page or a legal page. Its address is `/` and then its slug. Only an admin can edit, publish or unpublish a legal page. Nobody can delete a legal page. To change a legal page, edit it. Then publish it.
- **Menus.** The **Header** menu and the **Footer** menu hold the links at the top and at the bottom of each page. Change the links there.
