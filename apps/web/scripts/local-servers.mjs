import { connect } from "node:net";
import { resolve } from "node:path";

const PORTS = {
  [resolve("../../.wrangler/state")]: [8787, 8788],
  [resolve("../../.wrangler/preview")]: [8789],
};

export const portsFor = (state) => PORTS[resolve(state)] ?? [];

const answers = (port, host) =>
  new Promise((done) => {
    const socket = connect({ port, host });
    const settle = (open) => {
      socket.destroy();
      done(open);
    };
    socket.setTimeout(500);
    socket.once("connect", () => settle(true));
    socket.once("error", () => settle(false));
    socket.once("timeout", () => settle(false));
  });

export async function portsInUse(ports) {
  const busy = [];
  for (const port of ports) {
    const hits = await Promise.all(["127.0.0.1", "::1"].map((host) => answers(port, host)));
    if (hits.some(Boolean)) busy.push(port);
  }
  return busy;
}
