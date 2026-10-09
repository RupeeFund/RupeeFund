const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
  if (!secret) throw new Error("The signing secret is empty");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

const toBase64Url = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64url");

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
  return new Uint8Array(Buffer.from(text, "base64url"));
}

export async function seal(
  value: object,
  secret: string,
  ttlSeconds: number,
  now = Date.now(),
): Promise<string> {
  const body = toBase64Url(
    encoder.encode(JSON.stringify({ ...value, exp: now + ttlSeconds * 1000 })),
  );
  const mac = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(mac))}`;
}

export async function open(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): Promise<Record<string, unknown> | null> {
  const parts = token?.split(".") ?? [];
  if (parts.length !== 2 || !secret) return null;
  const [body = "", macText = ""] = parts;
  const bytes = fromBase64Url(body);
  const mac = fromBase64Url(macText);
  if (bytes === null || mac === null) return null;
  if (!(await crypto.subtle.verify("HMAC", await hmacKey(secret), mac, encoder.encode(body))))
    return null;
  try {
    const value: unknown = JSON.parse(decoder.decode(bytes));
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const { exp, ...rest } = value as Record<string, unknown>;
    return typeof exp === "number" && now < exp ? rest : null;
  } catch {
    return null;
  }
}
