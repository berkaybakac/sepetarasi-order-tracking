export class OrderNotFoundError extends Error {
	constructor(id: string) {
		super(`Order not found: ${id}`);
		this.name = "OrderNotFoundError";
	}
}

export class InvalidTransitionError extends Error {
	public from: string;
	public to: string;
	constructor(from: string, to: string) {
		super(`Invalid status transition: ${from} -> ${to}`);
		this.name = "InvalidTransitionError";
		this.from = from;
		this.to = to;
	}
}
