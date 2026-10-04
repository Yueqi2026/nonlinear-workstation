CREATE TABLE `workflow_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `project_id` text NOT NULL,
  `version` text NOT NULL,
  `status` text NOT NULL,
  `graph_json` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `confirmed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_workflow_versions_owner_project` ON `workflow_versions` (`owner_id`,`project_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `workflow_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `project_id` text NOT NULL,
  `workflow_version_id` text NOT NULL,
  `status` text NOT NULL,
  `config_json` text DEFAULT '{}' NOT NULL,
  `started_at` text,
  `finished_at` text,
  `error` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_workflow_runs_owner_created` ON `workflow_runs` (`owner_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `run_events` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL,
  `type` text NOT NULL,
  `node_id` text,
  `message` text NOT NULL,
  `payload_json` text DEFAULT '{}' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_run_events_run_created` ON `run_events` (`run_id`,`created_at`);
