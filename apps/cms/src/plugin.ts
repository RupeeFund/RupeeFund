import { env } from "cloudflare:workers";
import { definePlugin, type PluginContext } from "emdash";
import { policyDeleteGate, policyEditGate, policyGate, rebuildSite } from "./site-hooks.ts";

async function rebuild(_event: unknown, ctx: PluginContext): Promise<void> {
  const result = await rebuildSite(env.DEPLOY_HOOK_URL, fetch);
  if (result === "skipped") ctx.log.warn("DEPLOY_HOOK_URL is not set. The site does not rebuild.");
}

export function createPlugin() {
  return definePlugin({
    id: "rupeefund-site",
    version: "1.0.0",
    capabilities: ["content:read", "content:write", "hooks.content-policy:register"],
    hooks: {
      "content:beforeSave": async (event) => policyEditGate(event),
      "content:beforeDelete": async (event) => policyDeleteGate(event),
      "content:beforePublish": async (event) => policyGate(event),
      "content:beforeSchedule": async (event) => policyGate(event),
      "content:beforeUnpublish": async (event) => policyGate(event),
      "content:afterPublish": rebuild,
      "content:afterUnpublish": rebuild,
      "content:afterDelete": rebuild,
      "content:afterRestore": rebuild,
    },
  });
}
