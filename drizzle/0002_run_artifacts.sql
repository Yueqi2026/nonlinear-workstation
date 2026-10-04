CREATE TABLE `run_artifacts` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL,
  `node_id` text,
  `kind` text NOT NULL,
  `label` text NOT NULL,
  `provenance` text NOT NULL,
  `input_hash` text,
  `content_json` text DEFAULT '{}' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_run_artifacts_run_created` ON `run_artifacts` (`run_id`,`created_at`);
