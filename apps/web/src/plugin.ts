import { definePlugin, type PluginContext } from "emdash";
import { deleteGate, publishGate, saveGate, scheduleGate, type Store } from "./plugin/hooks.ts";

function store(ctx: PluginContext): Store {
  const content = ctx.content;
  if (content === undefined) throw new Error("rupeefund-site needs the content:read capability");
  return {
    async get(collection, id) {
      const item = await content.get(collection, id);
      if (item === null) return null;
      if (!item.draftRevisionId || item.draftRevisionId === item.liveRevisionId) {
        return { data: item.data };
      }
      if (content.getRevision === undefined) throw new Error("drafts cannot be read");
      const draft = await content.getRevision(collection, id, item.draftRevisionId);
      if (draft === null) throw new Error(`draft ${item.draftRevisionId} cannot be read`);
      return { data: item.data, draft: draft.data };
    },
    count: async (collection) => (await content.list(collection, { limit: 2 })).items.length,
  };
}

export function createPlugin() {
  return definePlugin({
    id: "rupeefund-site",
    version: "2.0.0",
    capabilities: [
      "content:read",
      "content:revisions:read",
      "content:write",
      "hooks.content-policy:register",
    ],
    admin: {
      portableTextBlocks: [
        {
          type: "callout",
          label: "Callout",
          description: "A short note set apart from the text",
          category: "Sections",
          fields: [
            {
              type: "select",
              action_id: "tone",
              label: "Tone",
              options: [
                { label: "Note", value: "note" },
                { label: "Highlight", value: "highlight" },
              ],
              initial_value: "note",
            },
            { type: "text_input", action_id: "text", label: "Text", multiline: true },
          ],
        },
        {
          type: "quote",
          label: "Quote",
          description: "A quote with the name of the person who said it",
          category: "Sections",
          fields: [
            { type: "text_input", action_id: "text", label: "Quote", multiline: true },
            { type: "text_input", action_id: "attribution", label: "Who said it" },
          ],
        },
        {
          type: "cta",
          label: "Call to action",
          icon: "link",
          description: "A button that links to a page",
          category: "Sections",
          fields: [
            { type: "text_input", action_id: "label", label: "Button text" },
            {
              type: "text_input",
              action_id: "url",
              label: "Link",
              placeholder: "/subscribe or https://…",
            },
          ],
        },
      ],
    },
    hooks: {
      "content:beforeSave": async (event, ctx) => saveGate(event, store(ctx)),
      "content:beforeDelete": async (event, ctx) => deleteGate(event, store(ctx)),
      "content:beforePublish": async (event, ctx) => publishGate(event, store(ctx)),
      "content:beforeUnpublish": async (event, ctx) => publishGate(event, store(ctx)),
      "content:beforeSchedule": async () => scheduleGate(),
    },
  });
}
