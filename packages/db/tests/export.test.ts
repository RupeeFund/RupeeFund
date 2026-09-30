import { describe, expect, it } from "vitest";
import { type ExportableRow, toCsv, toCsvField } from "../src/export.ts";

function csvFields(line: string): string[] {
  const field = /(?:"((?:[^"]|"")*)"|([^,"]*))(,|$)/y;
  const fields: string[] = [];
  for (let more = true; more;) {
    const [, quoted, plain, comma] = field.exec(line)!;
    fields.push(quoted === undefined ? plain : quoted.replaceAll('""', '"'));
    more = comma === ",";
  }
  return fields;
}

describe("CSV escaping survives the names people actually have", () => {
  it("leaves a plain value alone", () => {
    expect(toCsvField("Asha")).toBe("Asha");
  });

  it("quotes a value containing a comma", () => {
    expect(toCsvField("Rao, Asha")).toBe('"Rao, Asha"');
  });

  it("doubles embedded quotes rather than truncating the field", () => {
    expect(toCsvField('Asha "The" Rao')).toBe('"Asha ""The"" Rao"');
  });

  it("quotes a value containing a newline", () => {
    expect(toCsvField("Asha\nRao")).toBe('"Asha\nRao"');
  });

  it("passes non-ASCII through untouched", () => {
    expect(toCsvField("आशा")).toBe("आशा");
  });

  it("renders an absent value as empty rather than the string undefined", () => {
    expect(toCsvField(undefined)).toBe("");
  });
});

describe("the exported file is importable by a list manager", () => {
  const rows: ExportableRow[] = [
    {
      id: 1,
      email: "a@example.com",
      name: "Asha",
      source: "subscribe",
      consent_at: 10,
      created_at: 10,
      updates_opt_in: 1,
    },
    {
      id: 2,
      email: "b@example.com",
      name: 'B, "the" one',
      source: "footer",
      consent_at: 20,
      created_at: 20,
      updates_opt_in: 0,
    },
  ];

  it("writes one line per subscriber plus the header and a trailing newline", () => {
    expect(toCsv(rows).split("\n")).toHaveLength(4);
  });

  it("carries the consent record and a boolean updates choice as JSON attributes", () => {
    const records = toCsv(rows)
      .trim()
      .split("\n")
      .slice(1)
      .map(csvFields)
      .map(([email, name, attributes, ...extra]) => [
        email,
        name,
        JSON.parse(attributes),
        ...extra,
      ]);
    expect(records).toEqual([
      [
        "a@example.com",
        "Asha",
        { source: "subscribe", consent_at: 10, signed_up_at: 10, updates_opt_in: true },
      ],
      [
        "b@example.com",
        'B, "the" one',
        { source: "footer", consent_at: 20, signed_up_at: 20, updates_opt_in: false },
      ],
    ]);
  });

  it("emits only a header when nobody is pending", () => {
    expect(toCsv([])).toBe("email,name,attributes\n");
  });
});

describe("a spreadsheet cannot be made to execute the export", () => {
  for (const payload of ["=1+1", "+1", "-1", "@SUM(A1)"]) {
    it(`neutralises a field starting with ${payload[0]}`, () => {
      expect(toCsvField(payload).replace(/^"|"$/g, "").startsWith("'")).toBe(true);
    });
  }

  it("still quotes a neutralised field that also contains a comma", () => {
    expect(toCsvField("=cmd,x")).toBe(`"'=cmd,x"`);
  });
});
