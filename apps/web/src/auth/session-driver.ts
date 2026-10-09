import { env } from "cloudflare:workers";
import { sessionStore, type SessionStore } from "./session-store.ts";

export default (): SessionStore => sessionStore(() => env.DB);
