import http from "node:http";
import { networkInterfaces } from "node:os";

export const DISCOVERY_PROBE_TIMEOUT_MS = 800;
export const DISCOVERY_MAX_CONCURRENCY = 48;
const SAVED_URL_PROBE_TIMEOUT_MS = 2000;

export type ProbeHealth = (
	hostname: string,
	port: number,
	timeoutMs: number,
) => Promise<string | null>;

interface ScanHostsOptions {
	probeHealth?: ProbeHealth;
	maxConcurrency?: number;
	probeTimeoutMs?: number;
}

interface DiscoverServerOptions extends ScanHostsOptions {
	getPrivateSubnetBases?: () => string[];
}

export function probeHealth(
	hostname: string,
	port: number,
	timeoutMs: number,
): Promise<string | null> {
	return new Promise((resolve) => {
		const ac = new AbortController();
		let settled = false;
		const finish = (value: string | null) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(value);
		};
		const timer = setTimeout(() => {
			ac.abort();
			finish(null);
		}, timeoutMs);
		const req = http.get(
			{ hostname, port, path: "/health", signal: ac.signal as AbortSignal },
			(res) => {
				let body = "";
				res.on("data", (chunk: Buffer) => {
					body += chunk.toString();
				});
				res.on("end", () => {
					try {
						const data = JSON.parse(body) as { ok?: boolean };
						finish(data.ok === true ? `http://${hostname}:${port}` : null);
					} catch {
						finish(null);
					}
				});
				res.on("error", () => finish(null));
				res.on("aborted", () => finish(null));
			},
		);
		req.on("error", () => finish(null));
	});
}

export function getPrivateSubnetBases(
	ifacesByName: ReturnType<typeof networkInterfaces> = networkInterfaces(),
): string[] {
	const seen = new Set<string>();
	const bases: string[] = [];
	for (const ifaces of Object.values(ifacesByName)) {
		for (const iface of ifaces ?? []) {
			if (iface.family !== "IPv4" || iface.internal) continue;
			const octets = iface.address.split(".");
			if (octets.length !== 4) continue;
			const first = Number(octets[0]);
			const second = Number(octets[1]);
			const isPrivate =
				first === 10 ||
				(first === 172 && second >= 16 && second <= 31) ||
				(first === 192 && second === 168);
			if (!isPrivate) continue;
			const base = `${octets[0]}.${octets[1]}.${octets[2]}.0`;
			if (!seen.has(base)) {
				seen.add(base);
				bases.push(base);
			}
		}
	}
	return bases;
}

export async function scanHostsWithLimit(
	hosts: string[],
	port: number,
	options: ScanHostsOptions = {},
): Promise<string | null> {
	if (hosts.length === 0) return null;
	const probe = options.probeHealth ?? probeHealth;
	const probeTimeoutMs = options.probeTimeoutMs ?? DISCOVERY_PROBE_TIMEOUT_MS;
	const maxConcurrency = Math.max(
		1,
		Math.min(options.maxConcurrency ?? DISCOVERY_MAX_CONCURRENCY, hosts.length),
	);

	let found: string | null = null;
	let cursor = 0;

	const worker = async () => {
		while (!found) {
			const index = cursor;
			cursor += 1;
			if (index >= hosts.length) return;
			const hit = await probe(hosts[index], port, probeTimeoutMs);
			if (hit) {
				found = hit;
				return;
			}
		}
	};

	await Promise.all(Array.from({ length: maxConcurrency }, () => worker()));
	return found;
}

export async function scanSubnetsWithLimit(
	subnets: string[],
	port: number,
	options: ScanHostsOptions = {},
): Promise<string | null> {
	const hosts: string[] = [];
	for (const base of subnets) {
		const prefix = base.split(".").slice(0, 3).join(".");
		for (let i = 1; i <= 254; i += 1) {
			hosts.push(`${prefix}.${i}`);
		}
	}
	return scanHostsWithLimit(hosts, port, options);
}

export async function discoverServer(
	serverUrl: string,
	options: DiscoverServerOptions = {},
): Promise<string | null> {
	const probe = options.probeHealth ?? probeHealth;

	let targetPort = 3000;
	try {
		targetPort = Number(new URL(serverUrl).port) || 3000;
	} catch {
		// malformed URL — use default
	}

	// Step 1: re-probe saved URL (mDNS hostname or previously discovered IP)
	try {
		const saved = new URL(serverUrl);
		const hit = await probe(saved.hostname, Number(saved.port) || 3000, SAVED_URL_PROBE_TIMEOUT_MS);
		if (hit) return hit;
	} catch {
		// malformed URL — fall through
	}

	// Step 2: scan all private /24 subnets
	const subnets = options.getPrivateSubnetBases?.() ?? getPrivateSubnetBases();
	if (subnets.length === 0) return null;

	return scanSubnetsWithLimit(subnets, targetPort, {
		probeHealth: probe,
		maxConcurrency: options.maxConcurrency,
		probeTimeoutMs: options.probeTimeoutMs,
	});
}
