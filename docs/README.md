# Documentation

This folder holds the documents for the site of The Rupee Fund. Each document has one reader. Each fact has one owner.

## Responsibilities

| Document                           | Reader                                      | Holds                                                                                                                  |
| ---------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [README.md](../README.md)          | A visitor                                   | What The Rupee Fund is, in the words of the brand                                                                      |
| [CONTRIBUTING.md](CONTRIBUTING.md) | A person who wants to help                  | Where to talk, how to set up, how to open a pull request, and the gate to run first                                    |
| [DESIGN.md](DESIGN.md)             | A person or an agent who changes a page     | The instructions and the words that this repository adds to the brand guidelines                                       |
| [ARCHITECTURE.md](ARCHITECTURE.md) | A person or an agent who changes the system | How the system works: the Worker, the database, the names, the security headers and the brand files                    |
| [DEPLOY.md](DEPLOY.md)             | A maintainer                                | How a change reaches the live site: the branches, the promote, the migrations, the secrets, the export and the removal |
| [AGENTS.md](../AGENTS.md)          | An agent                                    | The map of the repository and the rules for an agent                                                                   |

Keep each document to its own job:

- README.md has one link, to this folder.
- CONTRIBUTING.md is for people. It holds no design rule and no detail of the code that can go out of date.
- DESIGN.md holds no rule that the brand guidelines own.

Two owners are outside this repository:

- The [brand guidelines](https://brand.rupeefund.org) own each design rule. Their source is [RupeeFund/brand](https://github.com/RupeeFund/brand).
- The [RupeeFund/.github](https://github.com/RupeeFund/.github) repository owns the code of conduct, the security policy, the support page, and the templates for an issue and a pull request.

## Index

Read the document that owns your change before you start.

- **Set up the repository, open a pull request or run the gate:** [CONTRIBUTING.md](CONTRIBUTING.md).
- **A page, a style, a word or a link preview card:** [DESIGN.md](DESIGN.md).
- **The Worker, the database, the security headers or the brand files:** [ARCHITECTURE.md](ARCHITECTURE.md).
- **A promote, a migration, a secret, an export or a removal:** [DEPLOY.md](DEPLOY.md).

## Get started

1. Read [CONTRIBUTING.md](CONTRIBUTING.md). It tells how to set up the repository and how to open a pull request.
1. Read the document that owns your change. The Index names it.
1. Run the gate in [CONTRIBUTING.md](CONTRIBUTING.md) before you commit.

## Change the documents

- Write a fact in the document that owns it. Link to it from the others.
- Write in ASD-STE100 Simplified Technical English.
