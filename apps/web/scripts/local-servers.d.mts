export function portsFor(state: string): number[];
export function portsInUse(ports: readonly number[]): Promise<number[]>;
export function listenerCwds(port: number): Promise<(string | null)[]>;
export function inCheckout(cwd: string): boolean;
