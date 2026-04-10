import { ORDER_TYPES, OrderStatus } from "@sepetarasi/shared";

export const createOrderBodySchema = {
	type: "object",
	required: ["customer_name", "order_type"],
	properties: {
		terminal_id: { type: "string" },
		customer_name: { type: "string", minLength: 1 },
		order_type: { type: "string", enum: ORDER_TYPES },
		target_minutes: { type: "integer", minimum: 1 },
		notes: { type: "string" },
		items: {
			type: "array",
			minItems: 0,
			items: {
				type: "object",
				required: ["name", "quantity", "unit_price"],
				properties: {
					name: { type: "string", minLength: 1 },
					quantity: { type: "integer", minimum: 1 },
					unit_price: { type: "integer", minimum: 0 },
					notes: { type: "string" },
				},
			},
		},
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
