CREATE TABLE `account_lifecycle_requests` (
	`lifecycle_request_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`request_type` text NOT NULL,
	`request_status` text NOT NULL,
	`requested_at` text NOT NULL,
	`cancelled_at` text,
	`completed_at` text,
	`completed_by_account_id` text,
	`retention_policy_version` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`completed_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `account_lifecycle_account_status_idx` ON `account_lifecycle_requests` (`account_id`,`request_status`);--> statement-breakpoint
CREATE TABLE `admin_bootstrap_state` (
	`bootstrap_id` text PRIMARY KEY NOT NULL,
	`used_by_account_id` text NOT NULL,
	`used_at` text NOT NULL,
	FOREIGN KEY (`used_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `retention_policy_versions` (
	`policy_version` text PRIMARY KEY NOT NULL,
	`account_closure_delay_days` integer NOT NULL,
	`audit_retention_days` integer NOT NULL,
	`activated_by_account_id` text NOT NULL,
	`activated_at` text NOT NULL,
	`retired_at` text,
	FOREIGN KEY (`activated_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `staff_invitation_tokens` (
	`invitation_id` text PRIMARY KEY NOT NULL,
	`token_digest` text NOT NULL,
	`email_binding_digest` text NOT NULL,
	`created_at` text NOT NULL,
	`consumed_at` text,
	FOREIGN KEY (`invitation_id`) REFERENCES `staff_invitations`(`invitation_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_invitation_tokens_digest_unique` ON `staff_invitation_tokens` (`token_digest`);--> statement-breakpoint
ALTER TABLE `staff_invitations` ADD `accepted_by_account_id` text REFERENCES accounts(account_id);--> statement-breakpoint
ALTER TABLE `staff_invitations` ADD `revoked_by_account_id` text REFERENCES accounts(account_id);--> statement-breakpoint
ALTER TABLE `staff_invitations` ADD `revoked_at` text;--> statement-breakpoint
CREATE TABLE `staff_invitation_acceptance_claims` (
	`invitation_id` text PRIMARY KEY NOT NULL,
	`accepted_by_account_id` text NOT NULL,
	`claimed_at` text NOT NULL,
	FOREIGN KEY (`invitation_id`) REFERENCES `staff_invitations`(`invitation_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accepted_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_lifecycle_requested_unique` ON `account_lifecycle_requests` (`account_id`,`request_type`) WHERE "account_lifecycle_requests"."request_status" = 'REQUESTED';--> statement-breakpoint
CREATE UNIQUE INDEX `permission_grants_active_unique` ON `permission_grants` (`account_id`,`permission_code`) WHERE "permission_grants"."revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `role_assignments_active_unique` ON `role_assignments` (`account_id`,`role_code`) WHERE "role_assignments"."revoked_at" IS NULL;--> statement-breakpoint
CREATE TRIGGER `staff_invitation_claim_guard`
BEFORE INSERT ON `staff_invitation_acceptance_claims`
FOR EACH ROW
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1
		FROM `staff_invitations` i
		JOIN `staff_invitation_tokens` t ON t.`invitation_id` = i.`invitation_id`
		JOIN `accounts` ia ON ia.`account_id` = i.`invited_by_account_id`
		JOIN `role_assignments` ir ON ir.`account_id` = ia.`account_id`
		JOIN `permission_grants` ip ON ip.`account_id` = ia.`account_id`
		WHERE i.`invitation_id` = NEW.`invitation_id`
			AND i.`invitation_status` = 'PENDING'
			AND i.`expires_at` > NEW.`claimed_at`
			AND t.`consumed_at` IS NULL
			AND ia.`account_status` = 'ACTIVE'
			AND ir.`role_code` = 'ADMIN' AND ir.`revoked_at` IS NULL
			AND ip.`permission_code` = 'staff_invitations.manage' AND ip.`revoked_at` IS NULL
	) THEN RAISE(ABORT, 'staff_invitation_not_claimable') END;
END;
