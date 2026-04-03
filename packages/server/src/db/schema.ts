import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// --- terminals ---

export const terminals = sqliteTable("terminals", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	type: text("type").notNull().default("kasa"),
	is_active: integer("is_active").notNull().default(1),
	last_seen_at: text("last_seen_at"),
	created_at: text("created_at").notNull().default("(datetime('now'))"),
});

// --- orders ---

export const orders = sqliteTable(
	"orders",
	{
		id: text("id").primaryKey(),
		business_date: text("business_date").notNull(),
		display_no: integer("display_no").notNull(),
		status: text("status").notNull().default("PREPARING"),
		terminal_id: text("terminal_id").references(() => terminals.id),
		notes: text("notes"),
		created_at: text("created_at").notNull().default("(datetime('now'))"),
		updated_at: text("updated_at").notNull().default("(datetime('now'))"),
		ready_at: text("ready_at"),
		delivered_at: text("delivered_at"),
		cancelled_at: text("cancelled_at"),
	},
	(table) => [
		uniqueIndex("uq_orders_business_date_display_no").on(table.business_date, table.display_no),
		index("idx_orders_status").on(table.status),
		index("idx_orders_business_date").on(table.business_date),
		index("idx_orders_created_at").on(table.created_at),
	],
);

// --- order_items ---

export const orderItems = sqliteTable(
	"order_items",
	{
		id: text("id").primaryKey(),
		order_id: text("order_id")
			.notNull()
			.references(() => orders.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		quantity: integer("quantity").notNull().default(1),
		unit_price: integer("unit_price").notNull(),
		notes: text("notes"),
	},
	(table) => [index("idx_order_items_order_id").on(table.order_id)],
);

// --- order_events ---

export const orderEvents = sqliteTable(
	"order_events",
	{
		id: text("id").primaryKey(),
		order_id: text("order_id")
			.notNull()
			.references(() => orders.id, { onDelete: "cascade" }),
		from_status: text("from_status"),
		to_status: text("to_status").notNull(),
		terminal_id: text("terminal_id").references(() => terminals.id),
		created_at: text("created_at").notNull().default("(datetime('now'))"),
	},
	(table) => [index("idx_order_events_order_id").on(table.order_id)],
);

// --- display_config ---

export const displayConfig = sqliteTable("display_config", {
	id: text("id").primaryKey(),
	terminal_id: text("terminal_id").references(() => terminals.id),
	show_preparing: integer("show_preparing").notNull().default(1),
	show_ready: integer("show_ready").notNull().default(1),
	columns: integer("columns").notNull().default(3),
	font_size: text("font_size").notNull().default("large"),
	theme: text("theme").notNull().default("dark"),
	updated_at: text("updated_at").notNull().default("(datetime('now'))"),
});

// --- app_settings ---

export const appSettings = sqliteTable("app_settings", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
	updated_at: text("updated_at").notNull().default("(datetime('now'))"),
});

// --- announcement_queue ---

export const announcementQueue = sqliteTable(
	"announcement_queue",
	{
		id: text("id").primaryKey(),
		order_id: text("order_id")
			.notNull()
			.references(() => orders.id, { onDelete: "cascade" }),
		display_no: integer("display_no").notNull(),
		type: text("type").notNull().default("ready"),
		status: text("status").notNull().default("pending"),
		enqueued_at: text("enqueued_at").notNull().default("(datetime('now'))"),
		played_at: text("played_at"),
		error: text("error"),
	},
	(table) => [
		uniqueIndex("uq_announcement_order_type").on(table.order_id, table.type),
		index("idx_announcement_status_enqueued").on(table.status, table.enqueued_at),
	],
);
