export const SUBSCRIBE_CTA = "I am interested";

export const REMOVAL_ADDRESS = "rupeefund@fossunited.org";

export const TAGLINE = "Not charity — membership in a commons";

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
