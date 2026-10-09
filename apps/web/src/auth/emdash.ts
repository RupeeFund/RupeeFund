import { env } from "cloudflare:workers";
import { identityOf, type Member } from "@rupeefund/auth";

export async function authenticate(request: Request): Promise<Member> {
  const identity = await identityOf(request, env.AUTH_SECRET, env.AUTH_ORIGIN);
  if (identity === null) throw new Error("No signed GitHub identity");
  return identity;
}
