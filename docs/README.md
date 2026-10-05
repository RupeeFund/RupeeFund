# Documentation

Each document has one reader. Each fact has one owner. Read the document that owns your change before you start.

| Document                           | Reader                                      | Read it before you change                                                                 |
| ---------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [CONTRIBUTING.md](CONTRIBUTING.md) | A person who wants to help                  | Anything. It holds the set-up, the pull request steps and the gate                        |
| [DESIGN.md](DESIGN.md)             | A person or an agent who changes a page     | A page, the blog, a style, a word or a link preview card                                  |
| [ARCHITECTURE.md](ARCHITECTURE.md) | A person or an agent who changes the system | A Worker, the database, the security headers, the brand files, the admin panel or the CMS |
| [DEPLOY.md](DEPLOY.md)             | A maintainer                                | A promote, a migration, a secret, an export, a removal, the admin login or the CMS        |
| [EDITING.md](EDITING.md)           | A volunteer who edits the site              | A post, an FAQ entry or other words in the content manager                                |
| [TODO.md](TODO.md)                 | A maintainer                                | A plan for new work, or a decision to defer work                                          |
| [AGENTS.md](../AGENTS.md)          | An agent                                    | Anything, as an agent                                                                     |

Two owners are outside this repository:

- The [brand guidelines](https://brand.rupeefund.org) own each brand rule. Their source is [RupeeFund/brand](https://github.com/RupeeFund/brand).
- The [RupeeFund/.github](https://github.com/RupeeFund/.github) repository owns the code of conduct, the security policy, the support page, and the templates for an issue and a pull request.

## Change the documents

- Write a fact in the document that owns it. Link to it from the others.
- Write only an instruction, or a fact that the code cannot show. Point to the code for the rest.
- README.md has two links: this folder and the Codespaces button.
- CONTRIBUTING.md is for people. It holds no brand rule and no detail of the code.
- EDITING.md tells what an editor sees in the content manager. It holds no detail of the code.
- DESIGN.md holds no rule that the brand guidelines own.
- Write the documents in ASD-STE100 Simplified Technical English. Do not use it for the words on the site.
- Do not write a Cloudflare account ID or a zone ID in a document. Do not write the name of a person with access. Name the resource instead.
