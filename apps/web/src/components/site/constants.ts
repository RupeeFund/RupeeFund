export const SUBSCRIBE_CTA = "I am interested";

export const REMOVAL_ADDRESS = "hello@rupeefund.org";

export const TAGLINE = "Lots of us, a little each month, for great projects from India";

export interface NavLink {
  label: string;
  href: string;
}

export const HEADER_LINKS: readonly NavLink[] = [
  { label: "FAQ", href: "/faq" },
  { label: "People", href: "/people" },
  { label: "Blog", href: "/blog" },
];

export const FOOTER_LINKS: readonly NavLink[] = [
  { label: "People", href: "/people" },
  { label: "Blog", href: "/blog" },
  { label: "About FOSS United", href: "https://fossunited.org/team" },
  { label: "Community forum", href: "https://forum.fossunited.org" },
  { label: "Source on GitHub", href: "https://github.com/RupeeFund/RupeeFund" },
];

export const linksFor = (links: readonly NavLink[], blog: boolean): readonly NavLink[] =>
  blog ? links : links.filter(({ href }) => href !== "/blog");

export type SeasonIcon = "snowflake" | "sun" | "cloud-rain" | "leaf";

export interface Season {
  icon: SeasonIcon;
  name: string;
  months: string;
  duration: string;
  accent: string;
}

export const SEASONS: readonly Season[] = [
  {
    icon: "snowflake",
    name: "Winter",
    months: "Dec – Feb",
    duration: "3 months",
    accent: "#007bb2",
  },
  {
    icon: "sun",
    name: "Summer",
    months: "Mar – May",
    duration: "3 months",
    accent: "#a44d00",
  },
  {
    icon: "cloud-rain",
    name: "Monsoon",
    months: "Jun – Aug",
    duration: "3 months",
    accent: "#008039",
  },
  {
    icon: "leaf",
    name: "Post-monsoon",
    months: "Sep – Nov",
    duration: "3 months",
    accent: "#b229ad",
  },
];
