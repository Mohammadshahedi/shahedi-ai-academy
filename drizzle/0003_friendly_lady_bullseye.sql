CREATE TABLE `lms_lifecycle_events` (
	`lifecycle_event_id` text PRIMARY KEY NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`reason_code` text NOT NULL,
	`resource_version` integer NOT NULL,
	`actor_account_id` text NOT NULL,
	`request_id` text NOT NULL,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`actor_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "lms_lifecycle_events_resource_type_check" CHECK("lms_lifecycle_events"."resource_type" IN ('COURSE', 'CLASS', 'LESSON', 'ENROLLMENT', 'INSTRUCTOR_ASSIGNMENT')),
	CONSTRAINT "lms_lifecycle_events_reason_check" CHECK("lms_lifecycle_events"."reason_code" IN ('RESOURCE_CREATED', 'CONTENT_READY', 'TEMPORARY_PAUSE', 'ADMIN_CORRECTION', 'PROGRAM_CLOSED', 'ENROLLMENT_COMPLETED', 'ENROLLMENT_WITHDRAWN', 'RE_ENROLLMENT', 'ASSIGNED', 'INSTRUCTOR_CHANGED')),
	CONSTRAINT "lms_lifecycle_events_version_check" CHECK("lms_lifecycle_events"."resource_version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lms_lifecycle_events_resource_version_unique` ON `lms_lifecycle_events` (`resource_type`,`resource_id`,`resource_version`);--> statement-breakpoint
CREATE INDEX `lms_lifecycle_events_resource_time_idx` ON `lms_lifecycle_events` (`resource_type`,`resource_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `lms_lifecycle_events_time_idx` ON `lms_lifecycle_events` (`occurred_at`,`lifecycle_event_id`);--> statement-breakpoint
ALTER TABLE `lms_classes` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_classes` ADD `activated_at` text;--> statement-breakpoint
ALTER TABLE `lms_classes` ADD `closed_at` text;--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `activated_at` text;--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `archived_at` text;--> statement-breakpoint
ALTER TABLE `lms_enrollments` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_enrollments` ADD `completed_at` text;--> statement-breakpoint
ALTER TABLE `lms_enrollments` ADD `withdrawn_at` text;--> statement-breakpoint
ALTER TABLE `lms_lessons` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_lessons` ADD `published_at` text;--> statement-breakpoint
ALTER TABLE `lms_lessons` ADD `archived_at` text;--> statement-breakpoint
CREATE TRIGGER `lms_lifecycle_events_append_only_update`
BEFORE UPDATE ON `lms_lifecycle_events`
BEGIN
	SELECT RAISE(ABORT, 'lms_lifecycle_events is append-only');
END;--> statement-breakpoint
CREATE TRIGGER `lms_lifecycle_events_append_only_delete`
BEFORE DELETE ON `lms_lifecycle_events`
BEGIN
	SELECT RAISE(ABORT, 'lms_lifecycle_events is append-only');
END;
