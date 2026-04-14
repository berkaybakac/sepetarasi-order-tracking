CREATE TABLE `music_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`display_name` text NOT NULL,
	`file_path` text NOT NULL,
	`file_size` integer NOT NULL,
	`duration_seconds` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`uploaded_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO app_settings (key, value, updated_at)
VALUES ('music_volume', '60', datetime('now'));
--> statement-breakpoint
INSERT OR IGNORE INTO app_settings (key, value, updated_at)
VALUES ('music_enabled', '0', datetime('now'));
