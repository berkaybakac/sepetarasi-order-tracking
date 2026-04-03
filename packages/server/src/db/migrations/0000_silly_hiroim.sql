CREATE TABLE `announcement_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`display_no` integer NOT NULL,
	`type` text DEFAULT 'ready' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`enqueued_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`played_at` text,
	`error` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_announcement_order_type` ON `announcement_queue` (`order_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_announcement_status_enqueued` ON `announcement_queue` (`status`,`enqueued_at`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `display_config` (
	`id` text PRIMARY KEY NOT NULL,
	`terminal_id` text,
	`show_preparing` integer DEFAULT 1 NOT NULL,
	`show_ready` integer DEFAULT 1 NOT NULL,
	`columns` integer DEFAULT 3 NOT NULL,
	`font_size` text DEFAULT 'large' NOT NULL,
	`theme` text DEFAULT 'dark' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`terminal_id`) REFERENCES `terminals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`terminal_id` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`terminal_id`) REFERENCES `terminals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_order_events_order_id` ON `order_events` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`name` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price` integer NOT NULL,
	`notes` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_order_items_order_id` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`business_date` text NOT NULL,
	`display_no` integer NOT NULL,
	`status` text DEFAULT 'PREPARING' NOT NULL,
	`terminal_id` text,
	`notes` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`ready_at` text,
	`delivered_at` text,
	`cancelled_at` text,
	FOREIGN KEY (`terminal_id`) REFERENCES `terminals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_orders_business_date_display_no` ON `orders` (`business_date`,`display_no`);--> statement-breakpoint
CREATE INDEX `idx_orders_status` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `idx_orders_business_date` ON `orders` (`business_date`);--> statement-breakpoint
CREATE INDEX `idx_orders_created_at` ON `orders` (`created_at`);--> statement-breakpoint
CREATE TABLE `terminals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'kasa' NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`last_seen_at` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
