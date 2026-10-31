# Documentation

Each document has one reader. Each fact has one owner. Read the document that owns your change before you start.

| Document                           | Reader                        | Read it before you change                                                                                       |
| ---------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Anyone who helps              | Anything: the set-up, the pull request steps, the gate                                                          |
| [DESIGN.md](DESIGN.md)             | Anyone who changes a page     | A page, the blog, a style, a word or a link preview card                                                        |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Anyone who changes the system | A Worker, an address, a database, the security headers, the brand files, the admin panel or the content manager |
| [DEPLOY.md](DEPLOY.md)             | Anyone whose change goes live | A migration, a content field, a page address, a secret or the words about payment                               |
| [EDITING.md](EDITING.md)           | A volunteer editor            | A post, an FAQ entry or other words in the content manager                                                      |
| [AGENTS.md](../AGENTS.md)          | An agent                      | Anything, as an agent                                                                                           |

Owners outside this repository:

- Each brand rule: the [brand guidelines](https://brand.rupeefund.org), from [RupeeFund/brand](https://github.com/RupeeFund/brand).
- The code of conduct, the security policy, the support page, and the issue and pull request templates: [RupeeFund/.github](https://github.com/RupeeFund/.github).
- The staff runbook (the admin steps), the mail setup and the to-do list: the private [RupeeFund/ops](https://github.com/RupeeFund/ops).

## Change the documents

- Write each fact in the document that owns it. Link to it from the others.
- Write only an instruction, or a fact that the code cannot show. Point to the code for the rest.
- Use ASD-STE100 Simplified Technical English, but not for the words on the site.
- README.md has two links: this folder and the Codespaces button.
- CONTRIBUTING.md and EDITING.md hold no detail of the code. CONTRIBUTING.md is for people. EDITING.md tells what an editor sees in the content manager.
- CONTRIBUTING.md and DESIGN.md hold no rule that the brand guidelines own.
- A document in this repository serves a contributor. Write a fact here only when a contributor needs it, or when it shows from outside the project.
- Write a step that only a maintainer with admin access takes in RupeeFund/ops. Link to it.
- Do not write a Cloudflare account ID, a zone ID or the name of a person with access. Name the resource instead.
