export class OrderNotFoundError extends Error {
	constructor(_id: string) {
		super("Sipariş bulunamadı.");
		this.name = "OrderNotFoundError";
	}
}

export class InvalidTransitionError extends Error {
	public from: string;
	public to: string;
	constructor(from: string, to: string) {
		super("Bu sipariş bu adıma alınamaz.");
		this.name = "InvalidTransitionError";
		this.from = from;
		this.to = to;
	}
}
