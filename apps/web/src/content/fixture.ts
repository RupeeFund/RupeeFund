import { POLICY_SLUGS, type ContentDocument } from "./schema.ts";

const para = (text: string) => [
  {
    _type: "block" as const,
    style: "normal" as const,
    markDefs: [],
    children: [{ _type: "span" as const, text, marks: [] }],
  },
];

export function validDocument(): ContentDocument {
  return {
    version: 1,
    posts: [
      {
        slug: "hello",
        title: "Hello",
        excerpt: "First post.",
        image: { src: "/media/01ABC.png", alt: "A red box", width: 8, height: 6 },
        body: para("Body."),
        publishedAt: "2026-10-02T17:40:48.365Z",
      },
    ],
    faq: [
      {
        slug: "voting",
        question: "How does voting work?",
        answer: para("You vote."),
        order: 1,
        home: true,
        sources: [{ title: "FOSS United grants", url: "https://fossunited.org/grants" }],
      },
    ],
    home: {
      heroLede: "Lede.",
      pitchTitle: "Pitch",
      pitchBody: para("Pitch body."),
      pitchSourceTitle: "Source",
      pitchSourceUrl: "https://github.blog/",
      stepsTitle: "How it works",
      steps: [{ title: "Subscribe", body: para("Step.") }],
      seasonsTitle: "Funding seasons",
      why: [{ title: "Nurture", body: "Why." }],
      faqTitle: "Frequently asked questions",
    },
    peoplePage: {
      teamTitle: "Community team",
      teamIntro: "Intro.",
      joinTitle: "Join",
      joinBody: "Join us.",
      foundationTitle: "Foundation",
      foundationBody: para("Host."),
    },
    people: [
      {
        slug: "mrugesh",
        name: "Mrugesh Mohapatra",
        bio: "Bio.",
        profileUrl: "https://fossunited.org/u/mrugesh",
        username: "mrugesh",
        photoUrl: "https://github.com/raisedadead.png?size=128",
        order: 1,
      },
    ],
    policies: POLICY_SLUGS.map((slug) => ({
      slug,
      title: slug,
      effectiveDate: "25 September 2026",
      body: para("Policy."),
    })),
  };
}
