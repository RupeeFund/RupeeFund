import { escapeHTML, toHTML, type PortableTextComponents } from "@portabletext/to-html";
import { isSafeHref, type PortableText } from "./schema.ts";

const attr = (value: string) => escapeHTML(value);

const plain = (value: unknown) => (typeof value === "string" ? escapeHTML(value) : "");

type Span = { _type: "span"; text: string; marks?: string[] };
type Cell = {
  isHeader?: boolean;
  colspan?: number;
  rowspan?: number;
  markDefs?: unknown[];
  content: Span[];
};

const CODE_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const escapeCode = (code: string) => code.replace(/[&<>"']/g, (char) => CODE_ESCAPES[char]!);
type Table = { hasHeaderRow?: boolean; markDefs?: unknown[]; rows: { cells: Cell[] }[] };

const components: PortableTextComponents = {
  block: {
    h1: ({ children }) => `<h2>${children}</h2>`,
  },
  marks: {
    link: ({ children, value }) => {
      const href = typeof value?.href === "string" ? value.href : "";
      if (!isSafeHref(href)) return children;
      const external = href.startsWith("https://")
        ? ' target="_blank" rel="noopener noreferrer"'
        : "";
      return `<a href="${attr(href)}"${external} class="inline-link">${children}</a>`;
    },
    subscript: ({ children }) => `<sub>${children}</sub>`,
    superscript: ({ children }) => `<sup>${children}</sup>`,
  },
  types: {
    image: ({ value }) => {
      const size = [
        typeof value.width === "number" ? ` width="${value.width}"` : "",
        typeof value.height === "number" ? ` height="${value.height}"` : "",
      ].join("");
      const source = `src="${attr(value.src)}" alt="${attr(value.alt)}"`;
      const img = `<img ${source}${size} loading="lazy" decoding="async">`;
      if (typeof value.caption !== "string" || !value.caption) return img;
      return `<figure>${img}<figcaption>${escapeHTML(value.caption)}</figcaption></figure>`;
    },
    code: ({ value }) => {
      const language =
        typeof value.language === "string" && value.language
          ? ` data-language="${attr(value.language)}"`
          : "";
      return `<pre${language}><code>${escapeCode(String(value.code ?? ""))}</code></pre>`;
    },
    break: () => "<hr>",
    table: ({ value }) => renderTable(value as Table),
    callout: ({ value }) => {
      const tone = value.tone === "highlight" ? "highlight" : "note";
      const text = `<p>${plain(value.text)}</p>`;
      return `<aside class="callout" data-tone="${tone}" role="note">${text}</aside>`;
    },
    quote: ({ value }) => {
      const by = plain(value.attribution);
      const caption = by ? `<figcaption>${by}</figcaption>` : "";
      const quote = `<blockquote><p>${plain(value.text)}</p></blockquote>`;
      return `<figure class="pull-quote">${quote}${caption}</figure>`;
    },
    cta: ({ value }) => {
      const url = typeof value.url === "string" ? value.url : "";
      if (!isSafeHref(url)) return "";
      const link = `<a href="${attr(url)}" class="btn btn-primary">${plain(value.label)}</a>`;
      return `<p class="cta">${link}</p>`;
    },
  },
};

function cellHtml(cell: Cell, tableDefs: unknown[]): string {
  const markDefs = [...tableDefs, ...(cell.markDefs ?? [])];
  const html = toHTML(
    { _type: "block", _key: "c", style: "normal", markDefs, children: cell.content },
    { components, onMissingComponent: false },
  );
  return html.slice("<p>".length, -"</p>".length);
}

function spans(cell: Cell): string {
  return [
    cell.colspan && cell.colspan > 1 ? ` colspan="${cell.colspan}"` : "",
    cell.rowspan && cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : "",
  ].join("");
}

function renderTable(value: Table): string {
  const markDefs = value.markDefs ?? [];
  const tag = (cell: Cell, head: boolean) =>
    head ? ["th", ' scope="col"'] : cell.isHeader ? ["th", ' scope="row"'] : ["td", ""];
  const row = (cells: Cell[], head: boolean) =>
    `<tr>${cells
      .map((cell) => {
        const [name, scope] = tag(cell, head);
        return `<${name}${scope}${spans(cell)}>${cellHtml(cell, markDefs)}</${name}>`;
      })
      .join("")}</tr>`;
  const [first, ...rest] = value.rows;
  const head = value.hasHeaderRow && first ? `<thead>${row(first.cells, true)}</thead>` : "";
  const body = (head ? rest : value.rows).map((r) => row(r.cells, false)).join("");
  return `<div class="table-wrap"><table>${head}<tbody>${body}</tbody></table></div>`;
}

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
