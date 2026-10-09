# Edit the site

The content manager at [rupeefund.org/admin](https://rupeefund.org/admin) holds the blog, the pages, the FAQ, the people page and the community team. The layout of each page stays the same. You change the words, not the structure.

The words of the home page and the links at the top and at the bottom of each page are not in the content manager. To change them, ask a maintainer.

## 1. Sign in

1. Ask an admin to add your GitHub account to a content team of the `RupeeFund` organization. The team gives your role.
1. If GitHub sends you an invitation to the organization, accept it. Until you accept it, the team does not count.
1. Open [rupeefund.org/admin](https://rupeefund.org/admin). The site sends you to GitHub to sign in. The first time, GitHub asks you to authorize the app of The Rupee Fund. Authorize it.

| GitHub team   | Role   |
| ------------- | ------ |
| `cms-authors` | Author |
| `cms-editors` | Editor |
| `cms-admins`  | Admin  |

If you are in two teams, you get the higher role. Your GitHub account must have a verified primary email address.

You stay signed in for 8 hours. Then you sign in again. A change to your team takes effect at your next sign-in. To change your role, ask an admin.

## 2. What each role can do

| Action                                                                                        | Author | Editor | Admin |
| --------------------------------------------------------------------------------------------- | ------ | ------ | ----- |
| Write a new entry and upload an image                                                         | Yes    | Yes    | Yes   |
| Edit, publish, unpublish and delete the entries that you wrote                                | Yes    | Yes    | Yes   |
| Edit, publish, unpublish and delete the other entries, and their images                       | No     | Yes    | Yes   |
| Change the author or the publish date of an entry                                             | No     | Yes    | Yes   |
| Change the categories and the bylines                                                         | No     | Yes    | Yes   |
| Edit, publish and unpublish the legal pages                                                   | No     | No     | Yes   |
| Empty the trash, which deletes an entry for good                                              | No     | No     | Yes   |
| Change the settings, the people of the content manager and the API tokens. Download a backup. | No     | No     | Yes   |

An Author can change only the entries that the Author wrote. The sample entries and the entries of other people are not yours. To change one of them, ask an Editor.

Nobody can do these things:

- Delete a legal page.
- Add, change or remove a field of a collection in the content manager. An admin does it with an API token.
- Import a site, or move the whole site to another host.

## 3. Publish a change

1. Save the entry as a draft.
1. For a post or a page, click **Preview**. The other entries have no **Preview**. Check them on the site after the publish.
1. Click **Publish**.

The site shows the change at the next page load. Check the page after each publish.

To undo a change, open the entry, restore an earlier revision and publish it. The content manager keeps the newest 50 revisions of each entry.

A deleted entry goes to the trash. To get it back, restore it from the trash.

## 4. Take care

Some changes take a page off the site, or change each page.

- **The people page.** It is one entry. If you unpublish or delete it, `/people` shows an error page.
- **The images.** Do not delete an image that an entry uses. The entry then shows a broken image.
- **The slugs.** Do not change the slug of a published entry. The old address then stops.
- **The categories.** If you delete a category, its posts show Blog.

If the site leaves out an entry or shows an error page, read section 8. Then correct the entry and publish it again. If you cannot find the problem, tell a maintainer.

## 5. Write a blog post

| Field       | What it does                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------- |
| Title       | The heading of the post and the name of the browser tab.                                           |
| Excerpt     | One or two sentences under the title. The blog list, the RSS feed and search results also show it. |
| Category    | The label above the title: Blog or Article. A post with no category shows Blog.                    |
| Season      | Optional. A label in the colour of the season.                                                     |
| Season year | The year of the season. If you leave it empty, the site uses the year of the publish date.         |
| Cover image | Optional. It shows on the blog list and across the top of the post.                                |
| Body        | The text of the post. Section 6 tells what it can hold.                                            |

Add each author as a byline. If the byline does not exist, ask an Editor to make it. A post with no byline shows "The Rupee Fund volunteers".

The post shows its publish date and its reading time. If you edit a post on a later day, it also shows the date of the edit.

The address of the post is `/blog/` and then its slug. Give each post a different slug.

## 6. What the body can hold

- Paragraphs. Make each paragraph one idea.
- Headings. Use Heading 2 for a section, and Heading 3 to Heading 6 in a section. The title of the post is the only Heading 1, so the site shows a Heading 1 as a Heading 2.
- Bulleted and numbered lists. A list can hold a list.
- Quotes, code blocks, tables and dividers.
- Images from the media library, with alt text and an optional caption.
- Bold, italic, code, underline, strike-through, subscript and superscript.
- Links.
- A callout, a quote with the name of the person who said it, and a call to action. Type `/` in the body to add one.

## 7. Images and words

- Upload each image to the media library first. Use PNG, JPEG, GIF, WebP or AVIF. Do not use SVG.
- Give each image alt text that tells what the image shows.
- Put the credit of an image in its caption.
- Write in the Voice of the [brand guidelines](https://brand.rupeefund.org). Use plain words and short sentences.
- Give a source for each figure.
- Start each link with `https://`, `mailto:`, `/` or `#`.

## 8. What the site refuses

The site leaves an entry out when the entry has one of these problems:

- An embed, an HTML block, a gallery or a reference. Remove the block.
- An image that is not in the media library, or an SVG image.
- A link that does not start with `https://`, `mailto:`, `/` or `#`. Change `http://` to `https://`.
- A callout, a quote or a call to action with no text.
- A team photo that is not on GitHub. Use the address of the GitHub profile photo.
- More than one paragraph in the foundation text of the people page.
- A slug with a character that is not a lowercase letter, a digit or a hyphen.

A post or a page that the site leaves out does not show at all. A people page that the site refuses shows an error page in its place.

## 9. The other pages

- **FAQ.** Each entry has a question, an answer and an order. A lower order shows first. Entries with the same order show the oldest first. To show a new entry last, give it a high order, such as 99.
- **FAQ on the home page.** Tick **Show on the home page** to show an entry there too.
- **FAQ sources.** A source is a title and an `https://` link.
- **People page.** Change its words. Do not make a second entry.
- **Community team.** Each person has a name, an order and an optional bio, profile URL, username and photo URL. The order works as in the FAQ.
- **Pages.** A page has a kind: a normal page or a legal page. Its address is `/` and then its slug. To remove a legal page, an admin changes its kind to a normal page first.
