-- طرح مفهومی و provider-neutral فاز ۳A.
-- این فایل migration اجرایی نیست و پیش از ۳B باید با موتور داده منتخب تطبیق داده شود.
-- همه شناسه‌ها در لایه برنامه تولید می‌شوند تا وابستگی به تابع خاص پایگاه داده ایجاد نشود.

CREATE TABLE accounts (
  account_id CHAR(36) PRIMARY KEY,
  account_status VARCHAR(20) NOT NULL
    CHECK (account_status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED')),
  account_category VARCHAR(24) NOT NULL
    CHECK (account_category IN ('ADULT_SELF_SERVICE', 'STAFF_INVITED')),
  adult_confirmed BOOLEAN NOT NULL,
  privacy_notice_version VARCHAR(40) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  closed_at TIMESTAMP NULL,
  CHECK (account_category <> 'ADULT_SELF_SERVICE' OR adult_confirmed = TRUE)
);

-- نگاشت هویت فقط شناسه مرجع را نگه می‌دارد؛ credential خام در این مدل ذخیره نمی‌شود.
CREATE TABLE account_identities (
  identity_id CHAR(36) PRIMARY KEY,
  account_id CHAR(36) NOT NULL,
  auth_source VARCHAR(40) NOT NULL,
  external_subject VARCHAR(255) NOT NULL,
  verified_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL,
  UNIQUE (auth_source, external_subject),
  FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

-- نقش‌ها نسخه‌دار و قابل لغو هستند؛ وجود ADMIN به معنی دسترسی نامحدود نیست.
CREATE TABLE role_assignments (
  role_assignment_id CHAR(36) PRIMARY KEY,
  account_id CHAR(36) NOT NULL,
  role_code VARCHAR(24) NOT NULL
    CHECK (role_code IN ('ADULT_STUDENT', 'GUARDIAN', 'INSTRUCTOR', 'ADMIN')),
  assigned_by_account_id CHAR(36) NULL,
  assignment_reason VARCHAR(500) NOT NULL,
  assigned_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(account_id),
  FOREIGN KEY (assigned_by_account_id) REFERENCES accounts(account_id),
  CHECK (revoked_at IS NULL OR revoked_at >= assigned_at)
);

-- نشست فقط digest غیرقابل‌بازگشت توکن را نگه می‌دارد و با لغو نقش قابل ابطال است.
CREATE TABLE account_sessions (
  session_id CHAR(36) PRIMARY KEY,
  account_id CHAR(36) NOT NULL,
  token_digest VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  revoke_reason VARCHAR(120) NULL,
  UNIQUE (token_digest),
  FOREIGN KEY (account_id) REFERENCES accounts(account_id),
  CHECK (expires_at > created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

-- این جدول فقط پرونده حداقلی فرد زیر ۱۸ سال است و حساب ورود مستقل ایجاد نمی‌کند.
CREATE TABLE minor_learner_profiles (
  learner_profile_id CHAR(36) PRIMARY KEY,
  preferred_name VARCHAR(80) NOT NULL,
  age_band VARCHAR(16) NOT NULL
    CHECK (age_band IN ('AGE_10_12', 'AGE_13_15', 'AGE_16_17')),
  profile_status VARCHAR(20) NOT NULL
    CHECK (profile_status IN ('PENDING', 'ACTIVE', 'ARCHIVED')),
  created_at TIMESTAMP NOT NULL,
  archived_at TIMESTAMP NULL,
  CHECK (archived_at IS NULL OR archived_at >= created_at)
);

-- پیوند سرپرستی پیش از ACTIVE ماندن نیازمند فرایند بررسی مصوب است.
CREATE TABLE guardian_learner_links (
  guardian_link_id CHAR(36) PRIMARY KEY,
  guardian_account_id CHAR(36) NOT NULL,
  learner_profile_id CHAR(36) NOT NULL,
  relationship_code VARCHAR(24) NOT NULL
    CHECK (relationship_code IN ('PARENT', 'LEGAL_GUARDIAN')),
  link_status VARCHAR(20) NOT NULL
    CHECK (link_status IN ('PENDING', 'ACTIVE', 'REJECTED', 'REVOKED')),
  reviewed_by_account_id CHAR(36) NULL,
  requested_at TIMESTAMP NOT NULL,
  reviewed_at TIMESTAMP NULL,
  revoked_at TIMESTAMP NULL,
  UNIQUE (guardian_account_id, learner_profile_id),
  FOREIGN KEY (guardian_account_id) REFERENCES accounts(account_id),
  FOREIGN KEY (learner_profile_id) REFERENCES minor_learner_profiles(learner_profile_id),
  FOREIGN KEY (reviewed_by_account_id) REFERENCES accounts(account_id),
  CHECK (reviewed_at IS NULL OR reviewed_at >= requested_at),
  CHECK (revoked_at IS NULL OR revoked_at >= requested_at)
);

-- هر رضایت به نسخه سیاست و هدف دقیق متصل می‌شود و قابل پس‌گرفتن است.
CREATE TABLE consent_records (
  consent_id CHAR(36) PRIMARY KEY,
  guardian_link_id CHAR(36) NOT NULL,
  policy_version VARCHAR(40) NOT NULL,
  purpose_code VARCHAR(60) NOT NULL
    CHECK (purpose_code IN ('EDUCATION_AND_PROGRESS_REPORTING')),
  granted_at TIMESTAMP NOT NULL,
  withdrawn_at TIMESTAMP NULL,
  FOREIGN KEY (guardian_link_id) REFERENCES guardian_learner_links(guardian_link_id),
  CHECK (withdrawn_at IS NULL OR withdrawn_at >= granted_at)
);

-- شناسه کلاس به مدل دوره فاز بعد ارجاع منطقی دارد و فعلاً قفل خارجی ندارد.
CREATE TABLE instructor_class_assignments (
  class_assignment_id CHAR(36) PRIMARY KEY,
  instructor_account_id CHAR(36) NOT NULL,
  class_id CHAR(36) NOT NULL,
  assigned_by_account_id CHAR(36) NOT NULL,
  assigned_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP NULL,
  FOREIGN KEY (instructor_account_id) REFERENCES accounts(account_id),
  FOREIGN KEY (assigned_by_account_id) REFERENCES accounts(account_id),
  CHECK (ended_at IS NULL OR ended_at >= assigned_at)
);

-- رویداد حسابرسی فقط شناسه‌ها و نتیجه عملیاتی را نگه می‌دارد، نه credential یا متن حساس.
CREATE TABLE audit_events (
  audit_event_id CHAR(36) PRIMARY KEY,
  actor_account_id CHAR(36) NULL,
  action_code VARCHAR(80) NOT NULL,
  target_type VARCHAR(60) NOT NULL,
  target_id CHAR(36) NULL,
  outcome_code VARCHAR(20) NOT NULL
    CHECK (outcome_code IN ('SUCCEEDED', 'DENIED', 'FAILED')),
  reason_code VARCHAR(80) NULL,
  request_id VARCHAR(64) NOT NULL,
  occurred_at TIMESTAMP NOT NULL,
  FOREIGN KEY (actor_account_id) REFERENCES accounts(account_id)
);

-- ایندکس‌ها الگو هستند و نام/نحو نهایی با موتور داده منتخب بازبینی می‌شود.
CREATE INDEX idx_roles_active_account
  ON role_assignments (account_id, revoked_at);

CREATE INDEX idx_guardian_links_active_guardian
  ON guardian_learner_links (guardian_account_id, link_status);

CREATE INDEX idx_guardian_links_learner
  ON guardian_learner_links (learner_profile_id, link_status);

CREATE INDEX idx_consents_guardian_link
  ON consent_records (guardian_link_id, withdrawn_at);

CREATE INDEX idx_instructor_active_class
  ON instructor_class_assignments (instructor_account_id, class_id, ended_at);

CREATE INDEX idx_audit_target_time
  ON audit_events (target_type, target_id, occurred_at);
