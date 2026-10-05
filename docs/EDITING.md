# Edit the site

The content manager at [cms.rupeefund.org/\_emdash/admin](https://cms.rupeefund.org/_emdash/admin) holds the words of the site: the blog, the FAQ, the home page, the people page, the community team and the policies. The layout of each page stays the same. You change the words, not the structure.

## 1. Sign in

An admin sends you an invite link. Open it and make a passkey. Then sign in with that passkey. The site sends no email, so **Sign in with email link** does not work.

| Role   | What the role can do                                                 |
| ------ | -------------------------------------------------------------------- |
| Author | Write entries. Edit, publish and delete your own entries.            |
| Editor | Edit, publish and delete each entry, except a policy.                |
| Admin  | All of the above. Edit the policies. Invite and remove other people. |

## 2. Publish a change

1. Save the entry as a draft.
1. Click **Preview**. The preview shows the draft as the site will show it.
1. Click **Publish**, or set a time to publish it later.

Each publish, unpublish, delete or restore builds the site again. The change is on the site after some minutes.

If the change is not on the site after 15 minutes, tell a maintainer. The site refused the content and kept the last good version. Section 5 lists what the site refuses.

To undo a change, open the entry, restore an earlier revision and publish it.

## 3. Write a blog post

| Field       | What it does                                                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title       | The heading of the post and the name of the browser tab.                                                                                             |
| Excerpt     | One or two sentences under the title. The blog list, the RSS feed and search results also show it.                                                   |
| Kind        | The label above the title: Update, Season report, Essay or Guide.                                                                                    |
| Season      | Optional. A label in the colour of the season.                                                                                                       |
| Season year | The year of the season. If you leave it empty, the site uses the year of the publish date.                                                           |
| Cover image | Optional. It shows on the blog list and across the top of the post. Give it alt text that tells what the image shows. Put the credit in the caption. |
| Body        | The text of the post. Section 4 tells what it can hold.                                                                                              |

Add each author as a byline. A post with no byline shows "The Rupee Fund volunteers".

The post shows its publish date and its reading time. If you edit a post on a later day, it also shows the date of the edit.

The address of the post is `/blog/` and then its slug. Give each post a different slug. Do not change the slug after you publish, because the old address then stops.

## 4. What the body can hold

- Paragraphs. Make each paragraph one idea.
- Headings. Use Heading 2 for a section, and Heading 3 to Heading 6 in a section. The title of the post is the only Heading 1, so the site shows a Heading 1 as a Heading 2.
- Bulleted and numbered lists. A list can hold a list.
- Quotes, code blocks, tables and dividers.
- Images from the media library, with alt text and an optional caption.
- Bold, italic, code, underline, strike-through, subscript and superscript.
- Links.

## 5. What the site refuses

The site refuses all of its content when one entry has one of these problems:

- An embed, an HTML block, a gallery or a reference. Remove the block.
- An image that is not in the media library. Upload the image first. Use PNG, JPEG, GIF, WebP or AVIF. Do not use SVG.
- A link that does not start with `https://`, `mailto:`, `/` or `#`. Change `http://` to `https://`.
- A team photo that is not on GitHub. Use the address of the GitHub profile photo.
- A heading, a list or a quote in the pitch text of the home page. Use plain paragraphs.
- More than one paragraph in a step of the home page, or in the foundation text of the people page.
- Two entries of the same kind with the same slug.
- A policy that is not published. The site needs all four policies.
- No published home page or people page.

## 6. The other pages

- **FAQ.** Each entry has a question, an answer and an order. A lower order shows first. Entries with the same order show the oldest first, so give a new entry a high order, such as 99, to show it last. Tick **Show on the home page** to show the entry there too. A source is a title and an `https://` link.
- **Home page** and **People page.** Each is one entry. Change its words. Do not make a second entry.
- **Community team.** Each person has a name, an order and an optional bio, profile URL, username and photo URL. The order works as in the FAQ.
- **Policies.** Only an admin can edit a policy. Nobody can delete a policy. To change one, edit it and publish it.
