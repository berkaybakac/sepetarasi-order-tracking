import type { FastifyInstance } from "fastify";

/**
 * Extract the port from a Fastify instance's server address.
 * Throws if the server is not listening on a TCP address.
 */
export function tcpListenPort(server: FastifyInstance["server"]): number {
	const addr = server.address();
	if (addr && typeof addr === "object" && "port" in addr) {
		return addr.port;
	}
	throw new Error("Expected TCP listen address");
}
