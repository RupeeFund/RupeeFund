const STORED_FILE_PREFIX = "/_emdash/api/media/file/";
const IMAGE_ENDPOINT = /^\/_image\/?$/;
const SESSION_TIMEOUT_MS = 3000;

export const SESSION_COOKIE = "astro-session";

export function needsSession(pathname: string): boolean {
  return pathname.startsWith(STORED_FILE_PREFIX) || IMAGE_ENDPOINT.test(pathname);
}

async function withTimeout<T>(read: () => Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(resolve, ms, undefined);
  });
  try {
    return await Promise.race([read().catch(() => undefined), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function refusesStranger(
  pathname: string,
  readUser?: () => Promise<unknown>,
  timeoutMs = SESSION_TIMEOUT_MS,
): Promise<boolean> {
  if (!needsSession(pathname)) return false;
  return readUser === undefined || !(await withTimeout(readUser, timeoutMs));
}
