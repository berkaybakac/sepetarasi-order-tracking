import { ORDER_TYPES, OrderStatus } from "@sepetarasi/shared";

export const createOrderBodySchema = {
	type: "object",
	required: ["customer_name", "order_type"],
	properties: {
		terminal_id: { type: "string" },
		customer_name: { type: "string", minLength: 1, maxLength: 60 },
		order_type: { type: "string", enum: ORDER_TYPES },
		target_minutes: { type: "integer", minimum: 1 },
		notes: { type: "string", maxLength: 300 },
		// Legacy field: accepted for API compatibility, carries no business logic.
		// Kasa sends []. Item-level validation removed — validating fields nobody writes is noise.
		items: { type: "array" },
	},
} as const;

export const updateStatusBodySchema = {
	type: "object",
	required: ["status"],
	properties: {
		status: { type: "string", enum: Object.values(OrderStatus) },
		terminal_id: { type: "string" },
	},
} as const;
