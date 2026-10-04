import { setTimeout as sleep } from "node:timers/promises";

export type Wait = (ms: number) => Promise<unknown>;

const TIMEOUT_MS = 30_000;
const RETRIES = 5;
const MAX_WAIT_MS = 60_000;

function retryDelay(res: Response): number {
  const seconds = Number(res.headers.get("retry-after"));
  return seconds > 0 ? Math.min(seconds * 1000, MAX_WAIT_MS) : MAX_WAIT_MS;
}

export async function fetchPatiently(
  url: string | URL,
  init: RequestInit,
  fetcher: typeof fetch = fetch,
  wait: Wait = sleep,
): Promise<Response> {
  const attempt = () => fetcher(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  let res = await attempt();
  for (let retry = 0; res.status === 429 && retry < RETRIES; retry++) {
    await wait(retryDelay(res));
    res = await attempt();
  }
  return res;
}
