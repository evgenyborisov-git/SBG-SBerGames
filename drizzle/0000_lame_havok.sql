CREATE TABLE `operations` (
	`player_id` text NOT NULL,
	`key` text NOT NULL,
	`action` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`player_id`, `key`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
