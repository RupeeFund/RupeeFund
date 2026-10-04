import { escapeHTML, toHTML, type PortableTextComponents } from "@portabletext/to-html";
import { isSafeHref, type PortableText } from "./schema.ts";

const attr = (value: string) => escapeHTML(value);

const components: PortableTextComponents = {
  marks: {
    link: ({ children, value }) => {
      const href = typeof value?.href === "string" ? value.href : "";
      if (!isSafeHref(href)) return children;
      const external = href.startsWith("https://")
        ? ' target="_blank" rel="noopener noreferrer"'
        : "";
      return `<a href="${attr(href)}"${external} class="inline-link">${children}</a>`;
    },
  },
  types: {
    image: ({ value }) => {
      const size = [
        typeof value.width === "number" ? ` width="${value.width}"` : "",
        typeof value.height === "number" ? ` height="${value.height}"` : "",
      ].join("");
      const source = `src="${attr(value.src)}" alt="${attr(value.alt)}"`;
      return `<img ${source}${size} loading="lazy" decoding="async">`;
    },
  },
};

export function toHtml(blocks: PortableText): string {
  return toHTML(
    blocks.map((block, index) => ({ _key: `b${index}`, ...block })),
    {
      components,
      onMissingComponent: false,
    },
  );
}

export function toInlineHtml(blocks: PortableText): string {
  const html = toHtml(blocks);
  const single = blocks.length === 1 && html.startsWith("<p>") && html.endsWith("</p>");
  return single ? html.slice("<p>".length, -"</p>".length) : html;
}
