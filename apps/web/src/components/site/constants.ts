export const SUBSCRIBE_CTA = "I am interested";

export const REMOVAL_ADDRESS = "rupeefund@fossunited.org";

export const TAGLINE = "Not charity — membership in a commons";

export interface NavLink {
  label: string;
  href: string;
}

export const HEADER_LINKS: readonly NavLink[] = [
  { label: "FAQ", href: "/faq" },
  { label: "People", href: "/people" },
];

export const FOOTER_LINKS: readonly NavLink[] = [
  { label: "People", href: "/people" },
  { label: "About FOSS United", href: "https://fossunited.org/team" },
  { label: "Community forum", href: "https://forum.fossunited.org" },
  { label: "Source on GitHub", href: "https://github.com/RupeeFund/RupeeFund" },
];

export interface Season {
  spriteSlug: string;
  name: string;
  months: string;
  duration: string;
  accent: string;
}

export const SEASONS: readonly Season[] = [
  {
    spriteSlug: "winter",
    name: "Winter",
    months: "Dec – Feb",
    duration: "3 months",
    accent: "#007bb2",
  },
  {
    spriteSlug: "summer",
    name: "Summer",
    months: "Mar – May",
    duration: "3 months",
    accent: "#a44d00",
  },
  {
    spriteSlug: "monsoon",
    name: "Monsoon",
    months: "Jun – Aug",
    duration: "3 months",
    accent: "#008039",
  },
  {
    spriteSlug: "post-monsoon",
    name: "Post-monsoon",
    months: "Sep – Nov",
    duration: "3 months",
    accent: "#b229ad",
  },
];
