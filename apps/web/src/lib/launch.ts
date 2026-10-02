import type { ReasonField, RoleField } from "@rupeefund/db/schema";

export const SUBSCRIBE_CTA = "I am interested";
export const SUBSCRIBE_HEADING = "I am interested!";

export const ROLE_LEGEND = "I am a";

export const ROLE_LABELS: Readonly<Record<RoleField, string>> = {
  is_user: "User or consumer",
  is_creator: "Developer, implementer, creator or designer",
  is_professional: "Professional",
  is_student: "Student",
};

export const REASON_LEGEND = "I am looking to join this fund";

export const REASON_LABELS: Readonly<Record<ReasonField, string>> = {
  backs_nascent: "To nurture new projects",
  backs_growing: "To encourage growing projects",
  backs_larger: "To sustain well-established projects",
};

export const REMOVAL_ADDRESS = "rupeefund@fossunited.org";

export const REFUND_ADDRESS = "audit@fossunited.org";

interface Season {
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
    months: "Jun – Sep",
    duration: "4 months",
    accent: "#008039",
  },
  {
    spriteSlug: "post-monsoon",
    name: "Post-monsoon",
    months: "Oct – Nov",
    duration: "2 months",
    accent: "#b229ad",
  },
];
