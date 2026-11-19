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

export const STICKER_SHAPES = [
  "polygon(0 2px, 100% 0, calc(100% - 3px) 100%, 2px calc(100% - 3px))",
  "polygon(2px 0, calc(100% - 2px) 3px, 100% calc(100% - 2px), 0 100%)",
  "polygon(0 0, calc(100% - 3px) 2px, 100% 100%, 3px calc(100% - 2px))",
  "polygon(3px 3px, 100% 0, calc(100% - 2px) calc(100% - 3px), 0 100%)",
] as const;

export const stickerShape = (i: number): string => STICKER_SHAPES[i % STICKER_SHAPES.length];

export type SeasonIcon = "snowflake" | "sun" | "cloud-rain" | "leaf";

export type SeasonArt = "winter" | "summer" | "monsoon" | "post-monsoon";

export type ReasonArt = "nurture" | "grow" | "sustain";

export interface Season {
  icon: SeasonIcon;
  art: SeasonArt;
  name: string;
  months: string;
  accent: string;
}

export const SEASONS: readonly Season[] = [
  {
    icon: "snowflake",
    art: "winter",
    name: "Winter",
    months: "Dec – Feb",
    accent: "#007bb2",
  },
  {
    icon: "sun",
    art: "summer",
    name: "Summer",
    months: "Mar – May",
    accent: "#a44d00",
  },
  {
    icon: "cloud-rain",
    art: "monsoon",
    name: "Monsoon",
    months: "Jun – Aug",
    accent: "#008039",
  },
  {
    icon: "leaf",
    art: "post-monsoon",
    name: "Post-monsoon",
    months: "Sep – Nov",
    accent: "#b229ad",
  },
];
