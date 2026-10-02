import { execSync } from "node:child_process";

const TEST_SITEKEY = "1x00000000000000000000AA";

export default function setup(): void {
  try {
    execSync("astro build --outDir dist-preview", {
      stdio: "pipe",
      env: {
        ...process.env,
        PUBLIC_TURNSTILE_SITEKEY: TEST_SITEKEY,
        PUBLIC_ALLOW_TEST_SITEKEY: "true",
      },
    });
  } catch (error) {
    const shown = error as { stdout?: Buffer; stderr?: Buffer };
    process.stderr.write(String(shown.stdout ?? ""));
    process.stderr.write(String(shown.stderr ?? ""));
    throw error;
  }
}
