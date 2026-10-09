import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { portsFor, portsInUse } from "./local-servers.mjs";

const STATE = resolve(process.argv[2] ?? "../../.wrangler/state");
const FIXTURES = "tests/fixtures/content";
const TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const D1_FILES = join(STATE, "v3", "d1", "miniflare-D1DatabaseObject");

// workaround: nodejs/node#21825 — a .cmd needs a shell, which searches CWD first
const WIN = process.platform === "win32";
const localBin = (name) => resolve("node_modules", ".bin", WIN ? `${name}.cmd` : name);

function run(bin, args) {
  const argv = WIN ? args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)) : args;
  const { status } = spawnSync(WIN ? `"${localBin(bin)}"` : localBin(bin), argv, {
    stdio: ["ignore", "inherit", "inherit"],
    env: process.env,
    shell: WIN,
  });
  if (status !== 0) {
    process.stderr.write(`${bin} ${args.slice(0, 2).join(" ")} failed. Nothing more ran.\n`);
    process.exit(status ?? 1);
  }
}

const databases = () =>
  readdirSync(D1_FILES).filter((file) => file.endsWith(".sqlite") && file !== "metadata.sqlite");

const busy = await portsInUse(portsFor(STATE));
if (busy.length > 0) {
  process.stderr.write(
    `A local server uses ${STATE} on port ${busy.join(" and ")}. Stop it, then run this again. Nothing changed.\n`,
  );
  process.exit(1);
}

for (const store of ["d1", "r2"])
  rmSync(join(STATE, "v3", store), { recursive: true, force: true });

run("wrangler", ["d1", "execute", "DB", "--local", "--persist-to", STATE, "--command", "SELECT 1"]);
const [content, ...others] = databases();
if (!content || others.length > 0) {
  process.stderr.write(`Expected one content database in ${D1_FILES}.\n`);
  process.exit(1);
}

const seed = JSON.parse(readFileSync("seed/seed.json", "utf8"));
const { dates, posts } = JSON.parse(readFileSync(join(FIXTURES, "posts.json"), "utf8"));
seed.content.posts = posts;
mkdirSync(STATE, { recursive: true });
const seedFile = join(STATE, "seed.json");
writeFileSync(seedFile, JSON.stringify(seed));
run("emdash", ["seed", seedFile, "-d", join(D1_FILES, content)]);
rmSync(seedFile);

const db = new DatabaseSync(join(D1_FILES, content));
const dated = db.prepare("UPDATE ec_posts SET published_at = ?, updated_at = ? WHERE slug = ?");
for (const [slug, { publishedAt, updatedAt }] of Object.entries(dates)) {
  dated.run(publishedAt, updatedAt, slug);
}
db.close();

for (const file of readdirSync(join(FIXTURES, "media"))) {
  run("wrangler", [
    "r2",
    "object",
    "put",
    `rupeefund-media/${file}`,
    "--local",
    "--persist-to",
    STATE,
    "--file",
    join(FIXTURES, "media", file),
    "--content-type",
    TYPES[extname(file).slice(1).toLowerCase()] ?? "application/octet-stream",
  ]);
}

run("wrangler", [
  "d1",
  "migrations",
  "apply",
  "rupeefund-waitlist",
  "--local",
  "--persist-to",
  STATE,
]);
process.stdout.write(`Seeded ${STATE} with the sample content.\n`);
