type Log = Pick<Console, "log" | "warn" | "error">;

export async function maintain(
  run: () => Promise<unknown>,
  started: Date,
  log: Log = console,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    log.error("[scheduled] EmDash maintenance failed:", error);
    return;
  }
  if (started.getUTCMinutes() === 0) log.log("[scheduled] cleanup ran");
  else {
    const at = started.toISOString();
    log.warn(`[scheduled] cleanup skipped: the run started at ${at}, not at minute 0`);
  }
}
