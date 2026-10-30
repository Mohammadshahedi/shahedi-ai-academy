/**
 * مدل اجرایی فاز ۳B روی D1. هیچ credential، رمز عبور یا داده واقعی کاربر در کد قرار نمی‌گیرد.
 * شناسه‌های دامنه در لایه برنامه تولید می‌شوند تا migration قابل‌پیش‌بینی بماند.
 */
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/* حساب فقط وضعیت دامنه را نگه می‌دارد؛ نشست و بازیابی برعهده هویت مدیریت‌شده Sites است. */
export const accounts = sqliteTable("accounts", {
  accountId: text("account_id").primaryKey(),
  accountStatus: text("account_status", { enum: ["ACTIVE", "SUSPENDED", "CLOSED"] }).notNull(),
  accountCategory: text("account_category", { enum: ["ADULT_SELF_SERVICE", "STAFF_INVITED"] }).notNull(),
  adultConfirmed: integer("adult_confirmed", { mode: "boolean" }).notNull(),
  privacyNoticeVersion: text("privacy_notice_version").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  closedAt: text("closed_at"),
}, (table) => [
  check("accounts_adult_self_service_check", sql`${table.accountCategory} <> 'ADULT_SELF_SERVICE' OR ${table.adultConfirmed} = 1`),
]);

/* externalSubject همان شناسه پایدار کاربر در همین Site است؛ ایمیل کلید حساب نیست. */
export const accountIdentities = sqliteTable("account_identities", {
  identityId: text("identity_id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.accountId, { onDelete: "cascade" }),
  authSource: text("auth_source").notNull(),
  externalSubject: text("external_subject").notNull(),
  verifiedAt: text("verified_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("account_identities_source_subject_unique").on(table.authSource, table.externalSubject),
  index("account_identities_account_idx").on(table.accountId),
]);

/* نقش‌ها قابل لغو هستند و در هر درخواست حساس دوباره از پایگاه داده خوانده می‌شوند. */
export const roleAssignments = sqliteTable("role_assignments", {
  roleAssignmentId: text("role_assignment_id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.accountId, { onDelete: "cascade" }),
  roleCode: text("role_code", { enum: ["ADULT_STUDENT", "GUARDIAN", "INSTRUCTOR", "ADMIN"] }).notNull(),
  assignedByAccountId: text("assigned_by_account_id").references(() => accounts.accountId),
  assignmentReason: text("assignment_reason").notNull(),
  assignedAt: text("assigned_at").notNull(),
  revokedAt: text("revoked_at"),
}, (table) => [
  index("role_assignments_active_account_idx").on(table.accountId, table.revokedAt),
  uniqueIndex("role_assignments_active_unique").on(table.accountId, table.roleCode).where(sql`${table.revokedAt} IS NULL`),
]);

/* مجوز ریزدانه مانع تبدیل نقش ADMIN به دسترسی نامحدود ضمنی می‌شود. */
export const permissionGrants = sqliteTable("permission_grants", {
  permissionGrantId: text("permission_grant_id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.accountId, { onDelete: "cascade" }),
  permissionCode: text("permission_code").notNull(),
  grantedByAccountId: text("granted_by_account_id").references(() => accounts.accountId),
  grantReason: text("grant_reason").notNull(),
  grantedAt: text("granted_at").notNull(),
  revokedAt: text("revoked_at"),
}, (table) => [
  index("permission_grants_active_account_idx").on(table.accountId, table.revokedAt),
  uniqueIndex("permission_grants_active_unique").on(table.accountId, table.permissionCode).where(sql`${table.revokedAt} IS NULL`),
]);

/* پرونده زیر ۱۸ سال حساب ورود ندارد و ایجاد آن فعلاً با دروازه سیاست مسدود است. */
export const minorLearnerProfiles = sqliteTable("minor_learner_profiles", {
  learnerProfileId: text("learner_profile_id").primaryKey(),
  preferredName: text("preferred_name").notNull(),
  ageBand: text("age_band", { enum: ["AGE_10_12", "AGE_13_15", "AGE_16_17"] }).notNull(),
  profileStatus: text("profile_status", { enum: ["PENDING", "ACTIVE", "ARCHIVED"] }).notNull(),
  createdAt: text("created_at").notNull(),
  archivedAt: text("archived_at"),
});

/* پیوند سرپرستی تا زمان بررسی مستقل در وضعیت PENDING باقی می‌ماند. */
export const guardianLearnerLinks = sqliteTable("guardian_learner_links", {
  guardianLinkId: text("guardian_link_id").primaryKey(),
  guardianAccountId: text("guardian_account_id").notNull().references(() => accounts.accountId),
  learnerProfileId: text("learner_profile_id").notNull().references(() => minorLearnerProfiles.learnerProfileId),
  relationshipCode: text("relationship_code", { enum: ["PARENT", "LEGAL_GUARDIAN"] }).notNull(),
  linkStatus: text("link_status", { enum: ["PENDING", "ACTIVE", "REJECTED", "REVOKED"] }).notNull(),
  reviewedByAccountId: text("reviewed_by_account_id").references(() => accounts.accountId),
  requestedAt: text("requested_at").notNull(),
  reviewedAt: text("reviewed_at"),
  revokedAt: text("revoked_at"),
}, (table) => [
  uniqueIndex("guardian_links_guardian_learner_unique").on(table.guardianAccountId, table.learnerProfileId),
  index("guardian_links_active_guardian_idx").on(table.guardianAccountId, table.linkStatus),
]);

/* هر رضایت به نسخه سیاست و هدف محدود متصل و قابل پس‌گرفتن است. */
export const consentRecords = sqliteTable("consent_records", {
  consentId: text("consent_id").primaryKey(),
  guardianLinkId: text("guardian_link_id").notNull().references(() => guardianLearnerLinks.guardianLinkId),
  policyVersion: text("policy_version").notNull(),
  purposeCode: text("purpose_code", { enum: ["EDUCATION_AND_PROGRESS_REPORTING"] }).notNull(),
  grantedAt: text("granted_at").notNull(),
  withdrawnAt: text("withdrawn_at"),
}, (table) => [index("consent_records_active_link_idx").on(table.guardianLinkId, table.withdrawnAt)]);

/* دعوت کارکنان فقط digest ایمیل را نگه می‌دارد؛ متن ایمیل در جدول ذخیره نمی‌شود. */
export const staffInvitations = sqliteTable("staff_invitations", {
  invitationId: text("invitation_id").primaryKey(),
  emailDigest: text("email_digest").notNull(),
  invitedRole: text("invited_role", { enum: ["INSTRUCTOR", "ADMIN"] }).notNull(),
  invitedByAccountId: text("invited_by_account_id").notNull().references(() => accounts.accountId),
  invitationStatus: text("invitation_status", { enum: ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"] }).notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  acceptedAt: text("accepted_at"),
  acceptedByAccountId: text("accepted_by_account_id").references(() => accounts.accountId),
  revokedByAccountId: text("revoked_by_account_id").references(() => accounts.accountId),
  revokedAt: text("revoked_at"),
}, (table) => [index("staff_invitations_digest_status_idx").on(table.emailDigest, table.invitationStatus)]);

/* توکن دعوت خام هرگز ذخیره نمی‌شود؛ digest توکن و binding ایمیل برای پذیرش تک‌مصرف کافی است. */
export const staffInvitationTokens = sqliteTable("staff_invitation_tokens", {
  invitationId: text("invitation_id").primaryKey().references(() => staffInvitations.invitationId, { onDelete: "cascade" }),
  tokenDigest: text("token_digest").notNull(),
  emailBindingDigest: text("email_binding_digest").notNull(),
  createdAt: text("created_at").notNull(),
  consumedAt: text("consumed_at"),
}, (table) => [uniqueIndex("staff_invitation_tokens_digest_unique").on(table.tokenDigest)]);

/* claim یکتا پذیرش دعوت را حتی در درخواست‌های هم‌زمان تک‌مصرف نگه می‌دارد. */
export const staffInvitationAcceptanceClaims = sqliteTable("staff_invitation_acceptance_claims", {
  invitationId: text("invitation_id").primaryKey().references(() => staffInvitations.invitationId, { onDelete: "cascade" }),
  acceptedByAccountId: text("accepted_by_account_id").notNull().references(() => accounts.accountId),
  claimedAt: text("claimed_at").notNull(),
});

/* رکورد تک‌ردیفی bootstrap جلوی استفاده دوباره راز حتی پس از لغو همه مدیرها را می‌گیرد. */
export const adminBootstrapState = sqliteTable("admin_bootstrap_state", {
  bootstrapId: text("bootstrap_id").primaryKey(),
  usedByAccountId: text("used_by_account_id").notNull().references(() => accounts.accountId),
  usedAt: text("used_at").notNull(),
});

/* درخواست چرخه عمر فقط وضعیت عملیاتی را نگه می‌دارد؛ حذف فیزیکی به سیاست مصوب وابسته است. */
export const accountLifecycleRequests = sqliteTable("account_lifecycle_requests", {
  lifecycleRequestId: text("lifecycle_request_id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.accountId, { onDelete: "cascade" }),
  requestType: text("request_type", { enum: ["ACCOUNT_DELETION"] }).notNull(),
  requestStatus: text("request_status", { enum: ["REQUESTED", "CANCELLED", "COMPLETED"] }).notNull(),
  requestedAt: text("requested_at").notNull(),
  cancelledAt: text("cancelled_at"),
  completedAt: text("completed_at"),
  completedByAccountId: text("completed_by_account_id").references(() => accounts.accountId),
  retentionPolicyVersion: text("retention_policy_version"),
}, (table) => [
  index("account_lifecycle_account_status_idx").on(table.accountId, table.requestStatus),
  uniqueIndex("account_lifecycle_requested_unique").on(table.accountId, table.requestType).where(sql`${table.requestStatus} = 'REQUESTED'`),
]);

/* جدول سیاست عددها را فقط پس از تصویب مدیریت/حقوقی می‌پذیرد و اکنون عمداً بدون داده اولیه است. */
export const retentionPolicyVersions = sqliteTable("retention_policy_versions", {
  policyVersion: text("policy_version").primaryKey(),
  accountClosureDelayDays: integer("account_closure_delay_days").notNull(),
  auditRetentionDays: integer("audit_retention_days").notNull(),
  activatedByAccountId: text("activated_by_account_id").notNull().references(() => accounts.accountId),
  activatedAt: text("activated_at").notNull(),
  retiredAt: text("retired_at"),
});

/* فاز ۳C.۱ فقط کاتالوگ آموزشی بزرگسالان را نگه می‌دارد؛ audience همیشه ADULT_ONLY است. */
export const lmsCourses = sqliteTable("lms_courses", {
  courseId: text("course_id").primaryKey(),
  audience: text("audience", { enum: ["ADULT_ONLY"] }).notNull(),
  title: text("title").notNull(),
  courseStatus: text("course_status", { enum: ["DRAFT", "ACTIVE", "ARCHIVED"] }).notNull(),
  version: integer("version").notNull().default(1),
  activatedAt: text("activated_at"),
  archivedAt: text("archived_at"),
  createdByAccountId: text("created_by_account_id").notNull().references(() => accounts.accountId),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  check("lms_courses_adult_only_check", sql`${table.audience} = 'ADULT_ONLY'`),
  check("lms_courses_status_check", sql`${table.courseStatus} IN ('DRAFT', 'ACTIVE', 'ARCHIVED')`),
  index("lms_courses_status_idx").on(table.courseStatus, table.createdAt),
]);

/* کلاس یک اجرای بدون زمان/قیمت از دوره است؛ جزئیات تجاری در این فاز مدل نمی‌شوند. */
export const lmsClasses = sqliteTable("lms_classes", {
  classId: text("class_id").primaryKey(),
  courseId: text("course_id").notNull().references(() => lmsCourses.courseId),
  title: text("title").notNull(),
  classStatus: text("class_status", { enum: ["DRAFT", "ACTIVE", "CLOSED"] }).notNull(),
  version: integer("version").notNull().default(1),
  activatedAt: text("activated_at"),
  closedAt: text("closed_at"),
  createdByAccountId: text("created_by_account_id").notNull().references(() => accounts.accountId),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  check("lms_classes_status_check", sql`${table.classStatus} IN ('DRAFT', 'ACTIVE', 'CLOSED')`),
  index("lms_classes_course_status_idx").on(table.courseId, table.classStatus),
]);

/* محتوای درس فقط متن ساده است؛ HTML، فایل و محتوای rich در ۳C.۱ پذیرفته نمی‌شوند. */
export const lmsLessons = sqliteTable("lms_lessons", {
  lessonId: text("lesson_id").primaryKey(),
  courseId: text("course_id").notNull().references(() => lmsCourses.courseId),
  title: text("title").notNull(),
  bodyText: text("body_text").notNull(),
  position: integer("position").notNull(),
  lessonStatus: text("lesson_status", { enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] }).notNull(),
  version: integer("version").notNull().default(1),
  publishedAt: text("published_at"),
  archivedAt: text("archived_at"),
  publishedRevisionId: text("published_revision_id"),
  createdByAccountId: text("created_by_account_id").notNull().references(() => accounts.accountId),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  check("lms_lessons_position_check", sql`${table.position} >= 1`),
  check("lms_lessons_status_check", sql`${table.lessonStatus} IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')`),
  uniqueIndex("lms_lessons_course_position_unique").on(table.courseId, table.position),
  index("lms_lessons_course_status_idx").on(table.courseId, table.lessonStatus, table.position),
]);

export const lmsLessonRevisions = sqliteTable("lms_lesson_revisions", {
  revisionId: text("revision_id").primaryKey(),
  lessonId: text("lesson_id").notNull().references(() => lmsLessons.lessonId),
  title: text("title").notNull(),
  bodyText: text("body_text").notNull(),
  createdByAccountId: text("created_by_account_id").notNull().references(() => accounts.accountId),
  createdAt: text("created_at").notNull(),
}, (table) => [index("lms_lesson_revisions_lesson_time_idx").on(table.lessonId, table.createdAt, table.revisionId)]);

export const lmsLessonPublications = sqliteTable("lms_lesson_publications", {
  publicationId: text("publication_id").primaryKey(),
  lessonId: text("lesson_id").notNull().references(() => lmsLessons.lessonId),
  revisionId: text("revision_id").notNull().references(() => lmsLessonRevisions.revisionId),
  lessonVersion: integer("lesson_version").notNull(),
  reasonCode: text("reason_code", { enum: ["CONTENT_UPDATE", "CONTENT_ROLLBACK"] }).notNull(),
  publishedByAccountId: text("published_by_account_id").notNull().references(() => accounts.accountId),
  publishedAt: text("published_at").notNull(),
}, (table) => [
  uniqueIndex("lms_lesson_publications_lesson_version_unique").on(table.lessonId, table.lessonVersion),
  index("lms_lesson_publications_lesson_time_idx").on(table.lessonId, table.publishedAt, table.publicationId),
]);

/* ثبت‌نام فقط پیوند حساب بزرگسال و کلاس است؛ پرداخت، قیمت و ظرفیت در این جدول وجود ندارد. */
export const lmsEnrollments = sqliteTable("lms_enrollments", {
  enrollmentId: text("enrollment_id").primaryKey(),
  classId: text("class_id").notNull().references(() => lmsClasses.classId),
  studentAccountId: text("student_account_id").notNull().references(() => accounts.accountId),
  enrollmentStatus: text("enrollment_status", { enum: ["ACTIVE", "COMPLETED", "WITHDRAWN"] }).notNull(),
  version: integer("version").notNull().default(1),
  completedAt: text("completed_at"),
  withdrawnAt: text("withdrawn_at"),
  createdByAccountId: text("created_by_account_id").notNull().references(() => accounts.accountId),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  check("lms_enrollments_status_check", sql`${table.enrollmentStatus} IN ('ACTIVE', 'COMPLETED', 'WITHDRAWN')`),
  uniqueIndex("lms_enrollments_class_student_unique").on(table.classId, table.studentAccountId),
  index("lms_enrollments_student_status_idx").on(table.studentAccountId, table.enrollmentStatus),
]);

/* مدرس فقط با assignment فعال به کلاس متصل می‌شود و هیچ rosterای از این مدل استخراج نمی‌شود. */
export const lmsClassInstructorAssignments = sqliteTable("lms_class_instructor_assignments", {
  assignmentId: text("assignment_id").primaryKey(),
  classId: text("class_id").notNull().references(() => lmsClasses.classId),
  instructorAccountId: text("instructor_account_id").notNull().references(() => accounts.accountId),
  assignedByAccountId: text("assigned_by_account_id").notNull().references(() => accounts.accountId),
  assignedAt: text("assigned_at").notNull(),
  revokedAt: text("revoked_at"),
}, (table) => [
  uniqueIndex("lms_class_instructor_active_unique").on(table.classId, table.instructorAccountId).where(sql`${table.revokedAt} IS NULL`),
  index("lms_class_instructor_account_idx").on(table.instructorAccountId, table.revokedAt),
]);

/* تاریخچه چرخه عمر append-only است و فقط شناسه داخلی، وضعیت، دلیل بسته و نسخه را نگه می‌دارد. */
export const lmsLifecycleEvents = sqliteTable("lms_lifecycle_events", {
  lifecycleEventId: text("lifecycle_event_id").primaryKey(),
  resourceType: text("resource_type", { enum: ["COURSE", "CLASS", "LESSON", "ENROLLMENT", "INSTRUCTOR_ASSIGNMENT"] }).notNull(),
  resourceId: text("resource_id").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  reasonCode: text("reason_code", { enum: ["RESOURCE_CREATED", "CONTENT_READY", "TEMPORARY_PAUSE", "ADMIN_CORRECTION", "PROGRAM_CLOSED", "ENROLLMENT_COMPLETED", "ENROLLMENT_WITHDRAWN", "RE_ENROLLMENT", "ASSIGNED", "INSTRUCTOR_CHANGED"] }).notNull(),
  resourceVersion: integer("resource_version").notNull(),
  actorAccountId: text("actor_account_id").notNull().references(() => accounts.accountId),
  requestId: text("request_id").notNull(),
  occurredAt: text("occurred_at").notNull(),
}, (table) => [
  check("lms_lifecycle_events_resource_type_check", sql`${table.resourceType} IN ('COURSE', 'CLASS', 'LESSON', 'ENROLLMENT', 'INSTRUCTOR_ASSIGNMENT')`),
  check("lms_lifecycle_events_reason_check", sql`${table.reasonCode} IN ('RESOURCE_CREATED', 'CONTENT_READY', 'TEMPORARY_PAUSE', 'ADMIN_CORRECTION', 'PROGRAM_CLOSED', 'ENROLLMENT_COMPLETED', 'ENROLLMENT_WITHDRAWN', 'RE_ENROLLMENT', 'ASSIGNED', 'INSTRUCTOR_CHANGED')`),
  check("lms_lifecycle_events_version_check", sql`${table.resourceVersion} >= 1`),
  uniqueIndex("lms_lifecycle_events_resource_version_unique").on(table.resourceType, table.resourceId, table.resourceVersion),
  index("lms_lifecycle_events_resource_time_idx").on(table.resourceType, table.resourceId, table.occurredAt),
  index("lms_lifecycle_events_time_idx").on(table.occurredAt, table.lifecycleEventId),
]);

/* رخداد حسابرسی از payload، credential و متن حساس کاربر خالی نگه داشته می‌شود. */
export const auditEvents = sqliteTable("audit_events", {
  auditEventId: text("audit_event_id").primaryKey(),
  actorAccountId: text("actor_account_id").references(() => accounts.accountId),
  actionCode: text("action_code").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  outcomeCode: text("outcome_code", { enum: ["SUCCEEDED", "DENIED", "FAILED"] }).notNull(),
  reasonCode: text("reason_code"),
  requestId: text("request_id").notNull(),
  occurredAt: text("occurred_at").notNull(),
}, (table) => [index("audit_events_target_time_idx").on(table.targetType, table.targetId, table.occurredAt)]);

/* شمارنده پنجره ثابت، درخواست‌های تغییردهنده هر هویت را محدود می‌کند. */
export const rateLimitBuckets = sqliteTable("rate_limit_buckets", {
  actionCode: text("action_code").notNull(),
  subjectDigest: text("subject_digest").notNull(),
  windowStartedAt: integer("window_started_at").notNull(),
  requestCount: integer("request_count").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("rate_limit_bucket_unique").on(table.actionCode, table.subjectDigest, table.windowStartedAt),
  index("rate_limit_updated_idx").on(table.updatedAt),
]);
