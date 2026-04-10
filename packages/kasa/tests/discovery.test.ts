import { describe, expect, it, vi } from "vitest";
import {
	type ProbeHealth,
	discoverServer,
	getPrivateSubnetBases,
	scanHostsWithLimit,
} from "../electron/discovery";

describe("kasa discovery", () => {
	it("returns only RFC1918 /24 subnet bases", () => {
		const ifaces = {
			en0: [
				{
					address: "10.1.2.3",
					netmask: "255.0.0.0",
					family: "IPv4",
					mac: "00:00:00:00:00:00",
					internal: false,
					cidr: "10.1.2.3/8",
				},
				{
					address: "10.1.2.9",
					netmask: "255.0.0.0",
					family: "IPv4",
					mac: "00:00:00:00:00:00",
					internal: false,
					cidr: "10.1.2.9/8",
				},
			],
			en1: [
				{
					address: "172.20.9.11",
					netmask: "255.240.0.0",
					family: "IPv4",
					mac: "00:00:00:00:00:00",
					internal: false,
					cidr: "172.20.9.11/12",
				},
			],
			en2: [
				{
					address: "192.168.4.2",
					netmask: "255.255.0.0",
					family: "IPv4",
					mac: "00:00:00:00:00:00",
					internal: false,
					cidr: "192.168.4.2/16",
				},
			],
			ignoredPublic: [
				{
					address: "172.32.1.8",
					netmask: "255.255.0.0",
					family: "IPv4",
					mac: "00:00:00:00:00:00",
					internal: false,
					cidr: "172.32.1.8/16",
				},
				{
					address: "192.0.2.10",
					netmask: "255.255.255.0",
					family: "IPv4",
					mac: "00:00:00:00:00:00",
					internal: false,
					cidr: "192.0.2.10/24",
				},
			],
			loopback: [
				{
					address: "127.0.0.1",
					netmask: "255.0.0.0",
					family: "IPv4",
					mac: "00:00:00:00:00:00",
					internal: true,
					cidr: "127.0.0.1/8",
				},
			],
		} as ReturnType<typeof import("node:os").networkInterfaces>;

		expect(getPrivateSubnetBases(ifaces)).toEqual(["10.1.2.0", "172.20.9.0", "192.168.4.0"]);
	});

	it("returns saved URL immediately when saved host is healthy", async () => {
		const probe = vi.fn<ProbeHealth>(async (hostname, port) =>
			hostname === "saved-host" ? `http://${hostname}:${port}` : null,
		);
		const getSubnets = vi.fn(() => ["10.0.0.0"]);

		const result = await discoverServer("http://saved-host:3000", {
			probeHealth: probe,
			getPrivateSubnetBases: getSubnets,
		});

		expect(result).toBe("http://saved-host:3000");
		expect(probe).toHaveBeenCalledTimes(1);
		expect(probe).toHaveBeenCalledWith("saved-host", 3000, 2000);
		expect(getSubnets).not.toHaveBeenCalled();
	});

	it("falls back to subnet scan when saved host is down", async () => {
		const probe = vi.fn<ProbeHealth>(async (hostname, port) => {
			if (hostname === "saved-host") return null;
			if (hostname === "10.44.0.5") return `http://${hostname}:${port}`;
			return null;
		});

		const result = await discoverServer("http://saved-host:4000", {
			probeHealth: probe,
			getPrivateSubnetBases: () => ["10.44.0.0"],
			maxConcurrency: 8,
			probeTimeoutMs: 1,
		});

		expect(result).toBe("http://10.44.0.5:4000");
		expect(probe).toHaveBeenNthCalledWith(1, "saved-host", 4000, 2000);
	});

	it("respects max concurrency while scanning hosts", async () => {
		const hosts = Array.from({ length: 20 }, (_, i) => `10.0.0.${i + 1}`);
		let active = 0;
		let maxActive = 0;

		const probe: ProbeHealth = async () => {
			active += 1;
			maxActive = Math.max(maxActive, active);
			await new Promise((resolve) => setTimeout(resolve, 2));
			active -= 1;
			return null;
		};

		const result = await scanHostsWithLimit(hosts, 3000, {
			probeHealth: probe,
			maxConcurrency: 4,
			probeTimeoutMs: 1,
		});

		expect(result).toBeNull();
		expect(maxActive).toBeLessThanOrEqual(4);
	});

	it("returns null when saved host fails and no private subnets exist", async () => {
		const probe = vi.fn<ProbeHealth>(async () => null);

		const result = await discoverServer("http://saved-host:3000", {
			probeHealth: probe,
			getPrivateSubnetBases: () => [],
		});

		expect(result).toBeNull();
		expect(probe).toHaveBeenCalledTimes(1);
	});
});
