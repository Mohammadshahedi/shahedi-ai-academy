CREATE TABLE `lms_class_instructor_assignments` (
	`assignment_id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`instructor_account_id` text NOT NULL,
	`assigned_by_account_id` text NOT NULL,
	`assigned_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`class_id`) REFERENCES `lms_classes`(`class_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instructor_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lms_class_instructor_active_unique` ON `lms_class_instructor_assignments` (`class_id`,`instructor_account_id`) WHERE "lms_class_instructor_assignments"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX `lms_class_instructor_account_idx` ON `lms_class_instructor_assignments` (`instructor_account_id`,`revoked_at`);--> statement-breakpoint
CREATE TABLE `lms_classes` (
	`class_id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`class_status` text NOT NULL,
	`created_by_account_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `lms_courses`(`course_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "lms_classes_status_check" CHECK("lms_classes"."class_status" IN ('DRAFT', 'ACTIVE', 'CLOSED'))
);
--> statement-breakpoint
CREATE INDEX `lms_classes_course_status_idx` ON `lms_classes` (`course_id`,`class_status`);--> statement-breakpoint
CREATE TABLE `lms_courses` (
	`course_id` text PRIMARY KEY NOT NULL,
	`audience` text NOT NULL,
	`title` text NOT NULL,
	`course_status` text NOT NULL,
	`created_by_account_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "lms_courses_adult_only_check" CHECK("lms_courses"."audience" = 'ADULT_ONLY'),
	CONSTRAINT "lms_courses_status_check" CHECK("lms_courses"."course_status" IN ('DRAFT', 'ACTIVE', 'ARCHIVED'))
);
--> statement-breakpoint
CREATE INDEX `lms_courses_status_idx` ON `lms_courses` (`course_status`,`created_at`);--> statement-breakpoint
CREATE TABLE `lms_enrollments` (
	`enrollment_id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`student_account_id` text NOT NULL,
	`enrollment_status` text NOT NULL,
	`created_by_account_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `lms_classes`(`class_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "lms_enrollments_status_check" CHECK("lms_enrollments"."enrollment_status" IN ('ACTIVE', 'COMPLETED', 'WITHDRAWN'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lms_enrollments_class_student_unique` ON `lms_enrollments` (`class_id`,`student_account_id`);--> statement-breakpoint
CREATE INDEX `lms_enrollments_student_status_idx` ON `lms_enrollments` (`student_account_id`,`enrollment_status`);--> statement-breakpoint
CREATE TABLE `lms_lessons` (
	`lesson_id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`body_text` text NOT NULL,
	`position` integer NOT NULL,
	`lesson_status` text NOT NULL,
	`created_by_account_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `lms_courses`(`course_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "lms_lessons_position_check" CHECK("lms_lessons"."position" >= 1),
	CONSTRAINT "lms_lessons_status_check" CHECK("lms_lessons"."lesson_status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lms_lessons_course_position_unique` ON `lms_lessons` (`course_id`,`position`);--> statement-breakpoint
CREATE INDEX `lms_lessons_course_status_idx` ON `lms_lessons` (`course_id`,`lesson_status`,`position`);