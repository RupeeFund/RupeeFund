import type { ReasonField, RoleField } from "@rupeefund/db/schema";

export const SUBSCRIBE_HEADING = "I am interested!";

export const ROLE_LEGEND = "I am a";

export const ROLE_LABELS: Readonly<Record<RoleField, string>> = {
  is_user: "User or consumer",
  is_creator: "Developer, creator or maintainer",
  is_professional: "Professional",
  is_student: "Student",
};

export const REASON_LEGEND = "I am looking to join this fund";

export const REASON_LABELS: Readonly<Record<ReasonField, string>> = {
  backs_nascent: "To nurture new projects",
  backs_growing: "To encourage growing projects",
  backs_larger: "To sustain well-established projects",
};
