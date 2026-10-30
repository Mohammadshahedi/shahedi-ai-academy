CREATE TABLE `lms_lesson_publications` (
	`publication_id` text PRIMARY KEY NOT NULL,
	`lesson_id` text NOT NULL,
	`revision_id` text NOT NULL,
	`lesson_version` integer NOT NULL,
	`reason_code` text NOT NULL,
	`published_by_account_id` text NOT NULL,
	`published_at` text NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lms_lessons`(`lesson_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revision_id`) REFERENCES `lms_lesson_revisions`(`revision_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`published_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lms_lesson_publications_lesson_version_unique` ON `lms_lesson_publications` (`lesson_id`,`lesson_version`);--> statement-breakpoint
CREATE INDEX `lms_lesson_publications_lesson_time_idx` ON `lms_lesson_publications` (`lesson_id`,`published_at`,`publication_id`);--> statement-breakpoint
CREATE TABLE `lms_lesson_revisions` (
	`revision_id` text PRIMARY KEY NOT NULL,
	`lesson_id` text NOT NULL,
	`title` text NOT NULL,
	`body_text` text NOT NULL,
	`created_by_account_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lms_lessons`(`lesson_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lms_lesson_revisions_lesson_time_idx` ON `lms_lesson_revisions` (`lesson_id`,`created_at`,`revision_id`);--> statement-breakpoint
ALTER TABLE `lms_lessons` ADD `published_revision_id` text;--> statement-breakpoint
CREATE TRIGGER `lms_lesson_revisions_validate_insert` BEFORE INSERT ON `lms_lesson_revisions` BEGIN SELECT CASE WHEN length(NEW.title) < 2 OR length(NEW.title) > 120 OR length(NEW.body_text) < 1 OR length(NEW.body_text) > 20000 THEN RAISE(ABORT, 'invalid lesson revision') END; END;--> statement-breakpoint
CREATE TRIGGER `lms_lesson_revisions_append_only_update` BEFORE UPDATE ON `lms_lesson_revisions` BEGIN SELECT RAISE(ABORT, 'lms_lesson_revisions is append-only'); END;--> statement-breakpoint
CREATE TRIGGER `lms_lesson_revisions_append_only_delete` BEFORE DELETE ON `lms_lesson_revisions` BEGIN SELECT RAISE(ABORT, 'lms_lesson_revisions is append-only'); END;--> statement-breakpoint
CREATE TRIGGER `lms_lesson_publications_validate_insert` BEFORE INSERT ON `lms_lesson_publications` BEGIN SELECT CASE WHEN NEW.lesson_version < 1 OR NEW.reason_code NOT IN ('CONTENT_UPDATE','CONTENT_ROLLBACK') OR NOT EXISTS (SELECT 1 FROM lms_lesson_revisions r WHERE r.revision_id=NEW.revision_id AND r.lesson_id=NEW.lesson_id) THEN RAISE(ABORT, 'invalid lesson publication') END; END;--> statement-breakpoint
CREATE TRIGGER `lms_lesson_publications_append_only_update` BEFORE UPDATE ON `lms_lesson_publications` BEGIN SELECT RAISE(ABORT, 'lms_lesson_publications is append-only'); END;--> statement-breakpoint
CREATE TRIGGER `lms_lesson_publications_append_only_delete` BEFORE DELETE ON `lms_lesson_publications` BEGIN SELECT RAISE(ABORT, 'lms_lesson_publications is append-only'); END;--> statement-breakpoint
CREATE TRIGGER `lms_lessons_published_revision_insert` BEFORE INSERT ON `lms_lessons` WHEN NEW.published_revision_id IS NOT NULL BEGIN SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM lms_lesson_revisions r WHERE r.revision_id=NEW.published_revision_id AND r.lesson_id=NEW.lesson_id) THEN RAISE(ABORT, 'published revision ownership mismatch') END; END;--> statement-breakpoint
CREATE TRIGGER `lms_lessons_published_revision_update` BEFORE UPDATE OF `published_revision_id` ON `lms_lessons` WHEN NEW.published_revision_id IS NOT NULL BEGIN SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM lms_lesson_revisions r WHERE r.revision_id=NEW.published_revision_id AND r.lesson_id=NEW.lesson_id) THEN RAISE(ABORT, 'published revision ownership mismatch') END; END;
