CREATE TABLE `account_identities` (
	`identity_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`auth_source` text NOT NULL,
	`external_subject` text NOT NULL,
	`verified_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_identities_source_subject_unique` ON `account_identities` (`auth_source`,`external_subject`);--> statement-breakpoint
CREATE INDEX `account_identities_account_idx` ON `account_identities` (`account_id`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`account_id` text PRIMARY KEY NOT NULL,
	`account_status` text NOT NULL,
	`account_category` text NOT NULL,
	`adult_confirmed` integer NOT NULL,
	`privacy_notice_version` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`closed_at` text,
	CONSTRAINT "accounts_adult_self_service_check" CHECK("accounts"."account_category" <> 'ADULT_SELF_SERVICE' OR "accounts"."adult_confirmed" = 1)
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`audit_event_id` text PRIMARY KEY NOT NULL,
	`actor_account_id` text,
	`action_code` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`outcome_code` text NOT NULL,
	`reason_code` text,
	`request_id` text NOT NULL,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`actor_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_events_target_time_idx` ON `audit_events` (`target_type`,`target_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `consent_records` (
	`consent_id` text PRIMARY KEY NOT NULL,
	`guardian_link_id` text NOT NULL,
	`policy_version` text NOT NULL,
	`purpose_code` text NOT NULL,
	`granted_at` text NOT NULL,
	`withdrawn_at` text,
	FOREIGN KEY (`guardian_link_id`) REFERENCES `guardian_learner_links`(`guardian_link_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `consent_records_active_link_idx` ON `consent_records` (`guardian_link_id`,`withdrawn_at`);--> statement-breakpoint
CREATE TABLE `guardian_learner_links` (
	`guardian_link_id` text PRIMARY KEY NOT NULL,
	`guardian_account_id` text NOT NULL,
	`learner_profile_id` text NOT NULL,
	`relationship_code` text NOT NULL,
	`link_status` text NOT NULL,
	`reviewed_by_account_id` text,
	`requested_at` text NOT NULL,
	`reviewed_at` text,
	`revoked_at` text,
	FOREIGN KEY (`guardian_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`learner_profile_id`) REFERENCES `minor_learner_profiles`(`learner_profile_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guardian_links_guardian_learner_unique` ON `guardian_learner_links` (`guardian_account_id`,`learner_profile_id`);--> statement-breakpoint
CREATE INDEX `guardian_links_active_guardian_idx` ON `guardian_learner_links` (`guardian_account_id`,`link_status`);--> statement-breakpoint
CREATE TABLE `minor_learner_profiles` (
	`learner_profile_id` text PRIMARY KEY NOT NULL,
	`preferred_name` text NOT NULL,
	`age_band` text NOT NULL,
	`profile_status` text NOT NULL,
	`created_at` text NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE TABLE `permission_grants` (
	`permission_grant_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`permission_code` text NOT NULL,
	`granted_by_account_id` text,
	`grant_reason` text NOT NULL,
	`granted_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `permission_grants_active_account_idx` ON `permission_grants` (`account_id`,`revoked_at`);--> statement-breakpoint
CREATE TABLE `rate_limit_buckets` (
	`action_code` text NOT NULL,
	`subject_digest` text NOT NULL,
	`window_started_at` integer NOT NULL,
	`request_count` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limit_bucket_unique` ON `rate_limit_buckets` (`action_code`,`subject_digest`,`window_started_at`);--> statement-breakpoint
CREATE INDEX `rate_limit_updated_idx` ON `rate_limit_buckets` (`updated_at`);--> statement-breakpoint
CREATE TABLE `role_assignments` (
	`role_assignment_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`role_code` text NOT NULL,
	`assigned_by_account_id` text,
	`assignment_reason` text NOT NULL,
	`assigned_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `role_assignments_active_account_idx` ON `role_assignments` (`account_id`,`revoked_at`);--> statement-breakpoint
CREATE TABLE `staff_invitations` (
	`invitation_id` text PRIMARY KEY NOT NULL,
	`email_digest` text NOT NULL,
	`invited_role` text NOT NULL,
	`invited_by_account_id` text NOT NULL,
	`invitation_status` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	FOREIGN KEY (`invited_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `staff_invitations_digest_status_idx` ON `staff_invitations` (`email_digest`,`invitation_status`);