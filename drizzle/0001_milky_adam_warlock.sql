CREATE TABLE `pilot_errors` (
	`request_id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`day` text NOT NULL,
	`channel` text NOT NULL,
	`code` text NOT NULL,
	`source` text NOT NULL,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pilot_errors_daily_cap` ON `pilot_errors` (`player_id`,`day`);--> statement-breakpoint
CREATE INDEX `pilot_errors_day` ON `pilot_errors` (`day`);--> statement-breakpoint
CREATE TABLE `pilot_profiles` (
	`player_id` text PRIMARY KEY NOT NULL,
	`first_seen` integer NOT NULL,
	`first_day` text NOT NULL,
	`channel` text NOT NULL,
	`is_new` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pilot_profiles_cohort` ON `pilot_profiles` (`channel`,`first_day`);--> statement-breakpoint
CREATE TABLE `pilot_visits` (
	`player_id` text NOT NULL,
	`day` text NOT NULL,
	`first_at` integer NOT NULL,
	PRIMARY KEY(`player_id`, `day`),
	FOREIGN KEY (`player_id`) REFERENCES `pilot_profiles`(`player_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pilot_visits_day` ON `pilot_visits` (`day`);