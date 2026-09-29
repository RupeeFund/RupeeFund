import { SUBSCRIBE_HEADING } from "./launch.ts";

export const SITE_NAME = "The Rupee Fund";
export const SITE_URL = "https://rupeefund.org";
export const OG_IMAGE = `${SITE_URL}/og-card.png`;
export const LOGO_IMAGE = `${SITE_URL}/icon-512.png`;

export const INITIATIVE = "A community initiative from FOSS United";

export interface RouteSeo {
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly ogTitle?: string;
  readonly ogDescription?: string;
  readonly indexable: boolean;
}

const ROUTE_SEO: readonly RouteSeo[] = [
  {
    path: "/",
    title: "The Rupee Fund — A FOSS United Community Initiative",
    description: `Small monthly contributions that make FOSS in India sustainable. ${INITIATIVE}, run by volunteers.`,
    indexable: true,
  },
  {
    path: "/subscribe",
    title: `${SUBSCRIBE_HEADING} — The Rupee Fund`,
    description: `Hear first when monthly contributions open for Indian FOSS maintainers. ${INITIATIVE}.`,
    ogTitle: "I am interested! — The Rupee Fund",
    indexable: true,
  },
  {
    path: "/terms",
    title: "Terms — The Rupee Fund",
    description: `Terms for The Rupee Fund and its launch notification list. ${INITIATIVE}.`,
    indexable: true,
  },
  {
    path: "/code-of-conduct",
    title: "Code of conduct — The Rupee Fund",
    description: `Conduct standards for The Rupee Fund. ${INITIATIVE}.`,
    indexable: true,
  },
  {
    path: "/privacy",
    title: "Privacy — The Rupee Fund",
    description: `What we collect, what we do with your IP address, and how to leave the list. ${INITIATIVE}.`,
    ogDescription: `What we collect, and how to leave the list. ${INITIATIVE}.`,
    indexable: true,
  },
  {
    path: "/refunds",
    title: "Refunds — The Rupee Fund",
    description: `This site takes no payments yet. What we publish before launch, and where to ask about a refund. ${INITIATIVE}.`,
    ogDescription: `This site takes no payments yet. Where to ask about a refund. ${INITIATIVE}.`,
    indexable: true,
  },
  {
    path: "/people",
    title: "People — The Rupee Fund",
    description: `Meet the volunteers who run The Rupee Fund and maintain its website. ${INITIATIVE}.`,
    ogDescription: `Meet the volunteers who run The Rupee Fund. ${INITIATIVE}.`,
    indexable: true,
  },
  {
    path: "/waitlist-confirmed",
    title: "You’re on the list — The Rupee Fund",
    description: `You’ll hear from us the day The Rupee Fund opens. ${INITIATIVE}.`,
    indexable: false,
  },
  {
    path: "/waitlist-problem",
    title: "That didn’t go through — The Rupee Fund",
    description: `We couldn’t add you to the list. ${INITIATIVE}.`,
    indexable: false,
  },
  {
    path: "/404",
    title: "Page not found — The Rupee Fund",
    description: `That page doesn’t exist. ${INITIATIVE}.`,
    indexable: false,
  },
];

export function normalizePath(path: string): string {
  let normalized = path.replace(/\.html$/, "").replace(/\/index$/, "");
  if (normalized.length > 1) normalized = normalized.replace(/\/$/, "");
  return normalized === "" ? "/" : normalized;
}

export function seoForPath(path: string): Required<RouteSeo> & { readonly canonical: string } {
  const normalized = normalizePath(path);
  const route = ROUTE_SEO.find((entry) => entry.path === normalized);
  if (route === undefined) {
    // Falling back to the home entry gave the page the home canonical, which
    // tells a crawler the two are one page. Fail the build instead.
    throw new Error(`No SEO entry for ${normalized}. Add one to ROUTE_SEO in src/lib/seo.ts.`);
  }
  return {
    ...route,
    ogTitle: route.ogTitle ?? route.title,
    ogDescription: route.ogDescription ?? route.description,
    canonical: normalized === "/" ? SITE_URL : `${SITE_URL}${normalized}`,
  };
}

export const NON_INDEXABLE_PATHS: readonly string[] = ROUTE_SEO.filter(
  (route) => !route.indexable,
).map((route) => route.path);
