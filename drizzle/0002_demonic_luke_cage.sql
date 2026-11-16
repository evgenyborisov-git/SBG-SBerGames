CREATE TABLE `pilot_feedback` (
	`request_id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`day` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`clarity` text NOT NULL,
	`liked` text NOT NULL,
	`blocker` text NOT NULL,
	`comment` text NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pilot_feedback_daily` ON `pilot_feedback` (`player_id`,`day`);--> statement-breakpoint
CREATE INDEX `pilot_feedback_day` ON `pilot_feedback` (`day`);