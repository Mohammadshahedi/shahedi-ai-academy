/** خدمات مدیریتی فاز ۳B.2 با بازخوانی مجوز، عملیات اتمیک D1 و audit بدون PII. */
import { env } from "cloudflare:workers";
import { getAccountContext, recordAuditEvent, type AccountContext } from "@/lib/accounts";
import { createOpaqueToken, invitationDigests, secureSecretMatches } from "@/lib/phase3b-crypto";
import {
  ACCOUNT_PERMISSIONS,
  ACCOUNT_PRIVACY_NOTICE_VERSION,
  ACCOUNT_ROLES,
  BOOTSTRAP_ADMIN_PERMISSIONS,
  STAFF_ROLES,
  type AccountPermission,
  type AccountRole,
  type StaffRole,
} from "@/lib/phase3b-policy";

const AUTH_SOURCE = "CHATGPT_SITES";
const BOOTSTRAP_ID = "PRIMARY";
const STAFF_INVITATION_TTL_MS = 24 * 60 * 60 * 1000;
const INTERNAL_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type ManagedAccount = {
  accountId: string;
  status: "ACTIVE" | "SUSPENDED" | "CLOSED";
  category: "ADULT_SELF_SERVICE" | "STAFF_INVITED";
  roles: AccountRole[];
  permissions: AccountPermission[];
  createdAt: string;
};
export type ManagedInvitation = { invitationId: string; role: StaffRole; status: "PENDING"; createdAt: string; expiresAt: string };

type OperationResult<T = undefined> = { ok: true; value: T } | { ok: false; code: string };

/* همه عملیات این فایل در نبود binding به‌صورت fail-closed متوقف می‌شوند. */
function requireDb(): D1Database {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

/* شناسه مسیر فقط UUID داخلی است تا ورودی دلخواه هرگز به target audit تبدیل نشود. */
function isInternalId(value: string): boolean { return INTERNAL_ID_PATTERN.test(value); }

/* permission حساس درست پیش از mutation از D1 بازخوانی می‌شود تا context قدیمی معتبر نماند. */
async function hasFreshPermission(accountId: string, permission: AccountPermission): Promise<boolean> {
  const row = await requireDb().prepare(`
    SELECT 1 AS allowed
    FROM accounts a
    JOIN role_assignments r ON r.account_id = a.account_id
    JOIN permission_grants p ON p.account_id = a.account_id
    WHERE a.account_id = ? AND a.account_status = 'ACTIVE'
      AND r.role_code = 'ADMIN' AND r.revoked_at IS NULL
      AND p.permission_code = ? AND p.revoked_at IS NULL
    LIMIT 1
  `).bind(accountId, permission).first<{ allowed: number }>();
  return row?.allowed === 1;
}

/* رویداد deny بدون ایمیل، token، secret یا payload ورودی ثبت می‌شود. */
async function recordDenied(actorAccountId: string | null, actionCode: string, targetType: string, targetId: string | null, reasonCode: string, requestId: string): Promise<void> {
  await recordAuditEvent({ actorAccountId, actionCode, targetType, targetId, outcomeCode: "DENIED", reasonCode, requestId });
}

/* bootstrap مدیر نخست فقط یک‌بار، با secret محیط اجرا و برای حساب بزرگسال فعال انجام می‌شود. */
export async function bootstrapFirstAdmin(actor: AccountContext, providedSecret: string, requestId: string): Promise<OperationResult<AccountContext>> {
  const expectedSecret = env.ACADEMY_BOOTSTRAP_SECRET ?? "";
  if (expectedSecret.length < 32) return { ok: false, code: "BOOTSTRAP_NOT_CONFIGURED" };
  if (providedSecret.length < 32 || !await secureSecretMatches(providedSecret, expectedSecret)) {
    await recordDenied(actor.accountId, "admin.bootstrap", "SYSTEM", BOOTSTRAP_ID, "INVALID_BOOTSTRAP_SECRET", requestId);
    return { ok: false, code: "BOOTSTRAP_SECRET_INVALID" };
  }
  const db = requireDb();
  const [freshActor, priorBootstrap, activeAdmin] = await Promise.all([
    db.prepare("SELECT account_status AS status FROM accounts WHERE account_id = ?").bind(actor.accountId).first<{ status: string }>(),
    db.prepare("SELECT used_at FROM admin_bootstrap_state WHERE bootstrap_id = ?").bind(BOOTSTRAP_ID).first(),
    db.prepare(`SELECT 1 AS found FROM role_assignments r JOIN accounts a ON a.account_id = r.account_id WHERE r.role_code = 'ADMIN' AND r.revoked_at IS NULL AND a.account_status = 'ACTIVE' LIMIT 1`).first(),
  ]);
  if (freshActor?.status !== "ACTIVE") return { ok: false, code: "ACTIVE_ACCOUNT_REQUIRED" };
  if (priorBootstrap) return { ok: false, code: "BOOTSTRAP_ALREADY_USED" };
  if (activeAdmin) return { ok: false, code: "ADMIN_ALREADY_EXISTS" };
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    db.prepare("INSERT INTO admin_bootstrap_state (bootstrap_id, used_by_account_id, used_at) VALUES (?, ?, ?)").bind(BOOTSTRAP_ID, actor.accountId, now),
    db.prepare("INSERT OR IGNORE INTO role_assignments (role_assignment_id, account_id, role_code, assigned_by_account_id, assignment_reason, assigned_at, revoked_at) VALUES (?, ?, 'ADMIN', ?, 'one_time_admin_bootstrap', ?, NULL)").bind(crypto.randomUUID(), actor.accountId, actor.accountId, now),
  ];
  for (const permission of BOOTSTRAP_ADMIN_PERMISSIONS) {
    statements.push(db.prepare("INSERT OR IGNORE INTO permission_grants (permission_grant_id, account_id, permission_code, granted_by_account_id, grant_reason, granted_at, revoked_at) VALUES (?, ?, ?, ?, 'one_time_admin_bootstrap', ?, NULL)").bind(crypto.randomUUID(), actor.accountId, permission, actor.accountId, now));
  }
  statements.push(db.prepare("INSERT INTO audit_events (audit_event_id, actor_account_id, action_code, target_type, target_id, outcome_code, reason_code, request_id, occurred_at) VALUES (?, ?, 'admin.bootstrap', 'ACCOUNT', ?, 'SUCCEEDED', 'ONE_TIME_BOOTSTRAP', ?, ?)").bind(crypto.randomUUID(), actor.accountId, actor.accountId, requestId, now));
  try {
    await db.batch(statements);
  } catch {
    return { ok: false, code: "BOOTSTRAP_ALREADY_USED" };
  }
  const refreshed = await getAccountContextByAccountId(actor.accountId);
  if (!refreshed) throw new Error("Bootstrapped account is unreadable");
  return { ok: true, value: refreshed };
}

/* context حساب با شناسه دامنه برای پاسخ bootstrap و پذیرش دعوت بازسازی می‌شود. */
async function getAccountContextByAccountId(accountId: string): Promise<AccountContext | null> {
  const identity = await requireDb().prepare("SELECT external_subject FROM account_identities WHERE account_id = ? AND auth_source = ? LIMIT 1").bind(accountId, AUTH_SOURCE).first<{ external_subject: string }>();
  return identity ? getAccountContext(identity.external_subject) : null;
}

/* فهرست مدیریت فقط شناسه داخلی، وضعیت، نقش و permission را برمی‌گرداند و PII ندارد. */
export async function listManagedAccounts(actor: AccountContext, offset: number): Promise<OperationResult<{ accounts: ManagedAccount[]; nextOffset: number | null }>> {
  if (!await hasFreshPermission(actor.accountId, "accounts.read")) return { ok: false, code: "PERMISSION_REQUIRED" };
  const safeOffset = Number.isSafeInteger(offset) && offset >= 0 ? Math.min(offset, 10_000) : 0;
  const db = requireDb();
  const accountRows = await db.prepare(`SELECT account_id, account_status, account_category, created_at FROM accounts ORDER BY created_at DESC, account_id LIMIT 26 OFFSET ?`).bind(safeOffset).all<{ account_id: string; account_status: ManagedAccount["status"]; account_category: ManagedAccount["category"]; created_at: string }>();
  const pageRows = accountRows.results.slice(0, 25);
  const accounts = new Map<string, ManagedAccount>(pageRows.map((row) => [row.account_id, { accountId: row.account_id, status: row.account_status, category: row.account_category, roles: [] as AccountRole[], permissions: [] as AccountPermission[], createdAt: row.created_at }]));
  if (pageRows.length) {
    const ids = pageRows.map((row) => row.account_id);
    const placeholders = ids.map(() => "?").join(",");
    const [roles, permissions] = await Promise.all([
      db.prepare(`SELECT account_id, role_code FROM role_assignments WHERE revoked_at IS NULL AND account_id IN (${placeholders})`).bind(...ids).all<{ account_id: string; role_code: AccountRole }>(),
      db.prepare(`SELECT account_id, permission_code FROM permission_grants WHERE revoked_at IS NULL AND account_id IN (${placeholders})`).bind(...ids).all<{ account_id: string; permission_code: AccountPermission }>(),
    ]);
    for (const row of roles.results) if (ACCOUNT_ROLES.includes(row.role_code)) accounts.get(row.account_id)?.roles.push(row.role_code);
    for (const row of permissions.results) if (ACCOUNT_PERMISSIONS.includes(row.permission_code)) accounts.get(row.account_id)?.permissions.push(row.permission_code);
  }
  return { ok: true, value: { accounts: [...accounts.values()], nextOffset: accountRows.results.length > 25 ? safeOffset + 25 : null } };
}

/* تعلیق/فعال‌سازی با permission تازه، منع تغییر حساب خود و حفاظت آخرین مدیر انجام می‌شود. */
export async function changeAccountStatus(actor: AccountContext, targetAccountId: string, status: "ACTIVE" | "SUSPENDED", requestId: string): Promise<OperationResult<{ status: "ACTIVE" | "SUSPENDED" }>> {
  if (!isInternalId(targetAccountId)) {
    await recordDenied(actor.accountId, "account.status.change", "ACCOUNT", null, "INVALID_TARGET_ID", requestId);
    return { ok: false, code: "INVALID_TARGET_ID" };
  }
  if (targetAccountId === actor.accountId) return { ok: false, code: "SELF_STATUS_CHANGE_FORBIDDEN" };
  const db = requireDb();
  const now = new Date().toISOString();
  const row = await db.prepare(`
    UPDATE accounts SET account_status = ?, updated_at = ?
    WHERE account_id = ? AND account_status IN ('ACTIVE', 'SUSPENDED')
      AND EXISTS (
        SELECT 1 FROM accounts aa JOIN role_assignments ar ON ar.account_id = aa.account_id JOIN permission_grants pg ON pg.account_id = aa.account_id
        WHERE aa.account_id = ? AND aa.account_status = 'ACTIVE'
          AND ar.role_code = 'ADMIN' AND ar.revoked_at IS NULL
          AND pg.permission_code = 'accounts.status.manage' AND pg.revoked_at IS NULL
      )
      AND (
        ? <> 'SUSPENDED'
        OR NOT EXISTS (SELECT 1 FROM role_assignments tr WHERE tr.account_id = accounts.account_id AND tr.role_code = 'ADMIN' AND tr.revoked_at IS NULL)
        OR EXISTS (
          SELECT 1 FROM accounts oa JOIN role_assignments orr ON orr.account_id = oa.account_id
          WHERE oa.account_id <> accounts.account_id AND oa.account_status = 'ACTIVE'
            AND orr.role_code = 'ADMIN' AND orr.revoked_at IS NULL
        )
      )
    RETURNING account_status AS status
  `).bind(status, now, targetAccountId, actor.accountId, status).first<{ status: "ACTIVE" | "SUSPENDED" }>();
  if (!row) {
    await recordDenied(actor.accountId, "account.status.change", "ACCOUNT", targetAccountId, "STATUS_CHANGE_DENIED", requestId);
    return { ok: false, code: "STATUS_CHANGE_DENIED" };
  }
  await recordAuditEvent({ actorAccountId: actor.accountId, actionCode: "account.status.change", targetType: "ACCOUNT", targetId: targetAccountId, outcomeCode: "SUCCEEDED", reasonCode: status, requestId });
  return { ok: true, value: { status: row.status } };
}

/* نقش فقط برای حساب فعال دیگر صادر می‌شود و self-escalation مجاز نیست. */
export async function assignAccountRole(actor: AccountContext, targetAccountId: string, role: AccountRole, requestId: string): Promise<OperationResult> {
  if (!isInternalId(targetAccountId)) return { ok: false, code: "INVALID_TARGET_ID" };
  if (targetAccountId === actor.accountId) return { ok: false, code: "SELF_ROLE_CHANGE_FORBIDDEN" };
  if (!ACCOUNT_ROLES.includes(role)) return { ok: false, code: "INVALID_ROLE" };
  const db = requireDb();
  const now = new Date().toISOString();
  const result = await db.prepare(`
    INSERT OR IGNORE INTO role_assignments
      (role_assignment_id, account_id, role_code, assigned_by_account_id, assignment_reason, assigned_at, revoked_at)
    SELECT ?, ta.account_id, ?, ?, 'admin_role_assignment', ?, NULL
    FROM accounts ta
    WHERE ta.account_id = ? AND ta.account_status = 'ACTIVE'
      AND EXISTS (
        SELECT 1 FROM accounts aa JOIN role_assignments ar ON ar.account_id = aa.account_id JOIN permission_grants pg ON pg.account_id = aa.account_id
        WHERE aa.account_id = ? AND aa.account_status = 'ACTIVE'
          AND ar.role_code = 'ADMIN' AND ar.revoked_at IS NULL
          AND pg.permission_code = 'accounts.roles.manage' AND pg.revoked_at IS NULL
      )
  `).bind(crypto.randomUUID(), role, actor.accountId, now, targetAccountId, actor.accountId).run();
  if ((result.meta.changes ?? 0) < 1) return { ok: false, code: "ROLE_ASSIGNMENT_DENIED_OR_EXISTS" };
  await recordAuditEvent({ actorAccountId: actor.accountId, actionCode: "account.role.assign", targetType: "ACCOUNT", targetId: targetAccountId, outcomeCode: "SUCCEEDED", reasonCode: role, requestId });
  return { ok: true, value: undefined };
}

/* لغو نقش ADMIN آخر را با شرط SQL رد و پس از لغو، permissionهای مدیریتی بدون نقش را می‌بندد. */
export async function revokeAccountRole(actor: AccountContext, targetAccountId: string, role: AccountRole, requestId: string): Promise<OperationResult> {
  if (!isInternalId(targetAccountId)) {
    await recordDenied(actor.accountId, "account.role.revoke", "ACCOUNT", null, "INVALID_TARGET_ID", requestId);
    return { ok: false, code: "INVALID_TARGET_ID" };
  }
  if (targetAccountId === actor.accountId) return { ok: false, code: "SELF_ROLE_CHANGE_FORBIDDEN" };
  const db = requireDb();
  const now = new Date().toISOString();
  const [roleResult] = await db.batch([db.prepare(`
    UPDATE role_assignments SET revoked_at = ?
    WHERE role_assignment_id = (
      SELECT r.role_assignment_id FROM role_assignments r
      WHERE r.account_id = ? AND r.role_code = ? AND r.revoked_at IS NULL LIMIT 1
    )
      AND EXISTS (
        SELECT 1 FROM accounts aa JOIN role_assignments ar ON ar.account_id = aa.account_id JOIN permission_grants pg ON pg.account_id = aa.account_id
        WHERE aa.account_id = ? AND aa.account_status = 'ACTIVE'
          AND ar.role_code = 'ADMIN' AND ar.revoked_at IS NULL
          AND pg.permission_code = 'accounts.roles.manage' AND pg.revoked_at IS NULL
      )
      AND (
        ? <> 'ADMIN'
        OR EXISTS (
          SELECT 1 FROM accounts oa JOIN role_assignments orr ON orr.account_id = oa.account_id
          WHERE oa.account_id <> ? AND oa.account_status = 'ACTIVE'
            AND orr.role_code = 'ADMIN' AND orr.revoked_at IS NULL
        )
      )
  `).bind(now, targetAccountId, role, actor.accountId, role, targetAccountId),
  db.prepare(`UPDATE permission_grants SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL AND ? = 'ADMIN' AND NOT EXISTS (SELECT 1 FROM role_assignments r WHERE r.account_id = ? AND r.role_code = 'ADMIN' AND r.revoked_at IS NULL)`).bind(now, targetAccountId, role, targetAccountId)]);
  if ((roleResult.meta.changes ?? 0) < 1) {
    await recordDenied(actor.accountId, "account.role.revoke", "ACCOUNT", targetAccountId, "ROLE_REVOCATION_DENIED", requestId);
    return { ok: false, code: "ROLE_REVOCATION_DENIED" };
  }
  await recordAuditEvent({ actorAccountId: actor.accountId, actionCode: "account.role.revoke", targetType: "ACCOUNT", targetId: targetAccountId, outcomeCode: "SUCCEEDED", reasonCode: role, requestId });
  return { ok: true, value: undefined };
}

/* permission فقط به حساب فعال دارای نقش ADMIN و توسط مدیر دیگر داده می‌شود. */
export async function grantAccountPermission(actor: AccountContext, targetAccountId: string, permission: AccountPermission, requestId: string): Promise<OperationResult> {
  if (!isInternalId(targetAccountId)) return { ok: false, code: "INVALID_TARGET_ID" };
  if (targetAccountId === actor.accountId) return { ok: false, code: "SELF_PERMISSION_CHANGE_FORBIDDEN" };
  if (!ACCOUNT_PERMISSIONS.includes(permission)) return { ok: false, code: "INVALID_PERMISSION" };
  const db = requireDb();
  const now = new Date().toISOString();
  const result = await db.prepare(`
    INSERT OR IGNORE INTO permission_grants
      (permission_grant_id, account_id, permission_code, granted_by_account_id, grant_reason, granted_at, revoked_at)
    SELECT ?, ta.account_id, ?, ?, 'admin_permission_grant', ?, NULL
    FROM accounts ta
    WHERE ta.account_id = ? AND ta.account_status = 'ACTIVE'
      AND EXISTS (SELECT 1 FROM role_assignments tr WHERE tr.account_id = ta.account_id AND tr.role_code = 'ADMIN' AND tr.revoked_at IS NULL)
      AND EXISTS (
        SELECT 1 FROM accounts aa JOIN role_assignments ar ON ar.account_id = aa.account_id JOIN permission_grants pg ON pg.account_id = aa.account_id
        WHERE aa.account_id = ? AND aa.account_status = 'ACTIVE'
          AND ar.role_code = 'ADMIN' AND ar.revoked_at IS NULL
          AND pg.permission_code = 'accounts.roles.manage' AND pg.revoked_at IS NULL
      )
  `).bind(crypto.randomUUID(), permission, actor.accountId, now, targetAccountId, actor.accountId).run();
  if ((result.meta.changes ?? 0) < 1) return { ok: false, code: "PERMISSION_GRANT_DENIED_OR_EXISTS" };
  await recordAuditEvent({ actorAccountId: actor.accountId, actionCode: "account.permission.grant", targetType: "ACCOUNT", targetId: targetAccountId, outcomeCode: "SUCCEEDED", reasonCode: permission, requestId });
  return { ok: true, value: undefined };
}

/* permission خود قابل‌تغییر نیست و مجوز نقش‌گردانی آخرین مدیر مؤثر حفظ می‌شود. */
export async function revokeAccountPermission(actor: AccountContext, targetAccountId: string, permission: AccountPermission, requestId: string): Promise<OperationResult> {
  if (!isInternalId(targetAccountId)) return { ok: false, code: "INVALID_TARGET_ID" };
  if (targetAccountId === actor.accountId) return { ok: false, code: "SELF_PERMISSION_CHANGE_FORBIDDEN" };
  const db = requireDb();
  const now = new Date().toISOString();
  const result = await db.prepare(`
    UPDATE permission_grants SET revoked_at = ?
    WHERE permission_grant_id = (
      SELECT p.permission_grant_id FROM permission_grants p
      WHERE p.account_id = ? AND p.permission_code = ? AND p.revoked_at IS NULL LIMIT 1
    )
      AND EXISTS (
        SELECT 1 FROM accounts aa JOIN role_assignments ar ON ar.account_id = aa.account_id JOIN permission_grants ap ON ap.account_id = aa.account_id
        WHERE aa.account_id = ? AND aa.account_status = 'ACTIVE'
          AND ar.role_code = 'ADMIN' AND ar.revoked_at IS NULL
          AND ap.permission_code = 'accounts.roles.manage' AND ap.revoked_at IS NULL
      )
      AND (
        ? <> 'accounts.roles.manage'
        OR EXISTS (
          SELECT 1 FROM accounts oa
          JOIN role_assignments orr ON orr.account_id = oa.account_id
          JOIN permission_grants op ON op.account_id = oa.account_id
          WHERE oa.account_id <> ? AND oa.account_status = 'ACTIVE'
            AND orr.role_code = 'ADMIN' AND orr.revoked_at IS NULL
            AND op.permission_code = 'accounts.roles.manage' AND op.revoked_at IS NULL
        )
      )
  `).bind(now, targetAccountId, permission, actor.accountId, permission, targetAccountId).run();
  if ((result.meta.changes ?? 0) < 1) return { ok: false, code: "PERMISSION_REVOCATION_DENIED" };
  await recordAuditEvent({ actorAccountId: actor.accountId, actionCode: "account.permission.revoke", targetType: "ACCOUNT", targetId: targetAccountId, outcomeCode: "SUCCEEDED", reasonCode: permission, requestId });
  return { ok: true, value: undefined };
}

/* دعوت کارکنان token خام را فقط یک‌بار برمی‌گرداند و هیچ ایمیل خامی در D1 نمی‌نویسد. */
export async function createStaffInvitation(actor: AccountContext, email: string, role: StaffRole, requestId: string): Promise<OperationResult<{ invitationId: string; token: string; expiresAt: string }>> {
  if (!STAFF_ROLES.includes(role)) return { ok: false, code: "INVALID_STAFF_ROLE" };
  const token = createOpaqueToken();
  const digests = await invitationDigests(token, email);
  const invitationId = crypto.randomUUID();
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + STAFF_INVITATION_TTL_MS).toISOString();
  const db = requireDb();
  try {
    await db.batch([
      db.prepare(`
        INSERT INTO staff_invitations (invitation_id, email_digest, invited_role, invited_by_account_id, invitation_status, created_at, expires_at, accepted_at, accepted_by_account_id, revoked_by_account_id, revoked_at)
        SELECT ?, ?, ?, aa.account_id, 'PENDING', ?, ?, NULL, NULL, NULL, NULL
        FROM accounts aa
        JOIN role_assignments ar ON ar.account_id = aa.account_id
        JOIN permission_grants ap ON ap.account_id = aa.account_id
        WHERE aa.account_id = ? AND aa.account_status = 'ACTIVE'
          AND ar.role_code = 'ADMIN' AND ar.revoked_at IS NULL
          AND ap.permission_code = 'staff_invitations.manage' AND ap.revoked_at IS NULL
      `).bind(invitationId, digests.emailBindingDigest, role, createdAt, expiresAt, actor.accountId),
      db.prepare("INSERT INTO staff_invitation_tokens (invitation_id, token_digest, email_binding_digest, created_at, consumed_at) VALUES (?, ?, ?, ?, NULL)").bind(invitationId, digests.tokenDigest, digests.emailBindingDigest, createdAt),
      db.prepare("INSERT INTO audit_events (audit_event_id, actor_account_id, action_code, target_type, target_id, outcome_code, reason_code, request_id, occurred_at) VALUES (?, ?, 'staff_invitation.create', 'STAFF_INVITATION', ?, 'SUCCEEDED', ?, ?, ?)").bind(crypto.randomUUID(), actor.accountId, invitationId, role, requestId, createdAt),
    ]);
  } catch {
    return { ok: false, code: "PERMISSION_REQUIRED" };
  }
  return { ok: true, value: { invitationId, token, expiresAt } };
}

/* دعوت‌های باز بدون ایمیل و token برای لغو عملیاتی فهرست می‌شوند. */
export async function listPendingStaffInvitations(actor: AccountContext, offset: number): Promise<OperationResult<{ invitations: ManagedInvitation[]; nextOffset: number | null }>> {
  if (!await hasFreshPermission(actor.accountId, "staff_invitations.manage")) return { ok: false, code: "PERMISSION_REQUIRED" };
  const safeOffset = Number.isSafeInteger(offset) && offset >= 0 ? Math.min(offset, 10_000) : 0;
  const rows = await requireDb().prepare(`SELECT invitation_id, invited_role, invitation_status, created_at, expires_at FROM staff_invitations WHERE invitation_status = 'PENDING' ORDER BY created_at DESC, invitation_id LIMIT 26 OFFSET ?`).bind(safeOffset).all<{ invitation_id: string; invited_role: StaffRole; invitation_status: "PENDING"; created_at: string; expires_at: string }>();
  const pageRows = rows.results.slice(0, 25);
  const invitations = pageRows.filter((row) => isStaffRole(row.invited_role)).map((row) => ({ invitationId: row.invitation_id, role: row.invited_role, status: row.invitation_status, createdAt: row.created_at, expiresAt: row.expires_at }));
  return { ok: true, value: { invitations, nextOffset: rows.results.length > 25 ? safeOffset + 25 : null } };
}

/* لغو دعوت فقط روی وضعیت PENDING انجام و token خام هرگز بازخوانی نمی‌شود. */
export async function revokeStaffInvitation(actor: AccountContext, invitationId: string, requestId: string): Promise<OperationResult> {
  if (!isInternalId(invitationId)) {
    await recordDenied(actor.accountId, "staff_invitation.revoke", "STAFF_INVITATION", null, "INVALID_TARGET_ID", requestId);
    return { ok: false, code: "INVALID_TARGET_ID" };
  }
  const now = new Date().toISOString();
  const result = await requireDb().prepare(`
    UPDATE staff_invitations SET invitation_status = 'REVOKED', revoked_by_account_id = ?, revoked_at = ?
    WHERE invitation_id = ? AND invitation_status = 'PENDING'
      AND EXISTS (
        SELECT 1 FROM accounts aa
        JOIN role_assignments ar ON ar.account_id = aa.account_id
        JOIN permission_grants ap ON ap.account_id = aa.account_id
        WHERE aa.account_id = ? AND aa.account_status = 'ACTIVE'
          AND ar.role_code = 'ADMIN' AND ar.revoked_at IS NULL
          AND ap.permission_code = 'staff_invitations.manage' AND ap.revoked_at IS NULL
      )
  `).bind(actor.accountId, now, invitationId, actor.accountId).run();
  if ((result.meta.changes ?? 0) < 1) return { ok: false, code: "INVITATION_NOT_PENDING" };
  await recordAuditEvent({ actorAccountId: actor.accountId, actionCode: "staff_invitation.revoke", targetType: "STAFF_INVITATION", targetId: invitationId, outcomeCode: "SUCCEEDED", reasonCode: "ADMIN_REVOKED", requestId });
  return { ok: true, value: undefined };
}

/* پذیرش دعوت، token/ایمیل/انقضا را بررسی و claim یکتا را با ساخت حساب/نقش در یک batch ثبت می‌کند. */
export async function acceptStaffInvitation(input: { externalSubject: string; verifiedEmail: string; token: string; privacyNoticeVersion: string; requestId: string }): Promise<OperationResult<AccountContext>> {
  const db = requireDb();
  const digests = await invitationDigests(input.token, input.verifiedEmail);
  const invitation = await db.prepare(`
    SELECT i.invitation_id, i.invited_role, i.invitation_status, i.expires_at, t.consumed_at
    FROM staff_invitations i JOIN staff_invitation_tokens t ON t.invitation_id = i.invitation_id
    WHERE t.token_digest = ? AND t.email_binding_digest = ? AND i.email_digest = ?
    LIMIT 1
  `).bind(digests.tokenDigest, digests.emailBindingDigest, digests.emailBindingDigest).first<{ invitation_id: string; invited_role: StaffRole; invitation_status: string; expires_at: string; consumed_at: string | null }>();
  if (!invitation) return { ok: false, code: "INVITATION_INVALID" };
  if (!isStaffRole(invitation.invited_role)) return { ok: false, code: "INVITATION_INVALID" };
  const now = new Date().toISOString();
  if (invitation.invitation_status !== "PENDING" || invitation.consumed_at) return { ok: false, code: "INVITATION_NOT_PENDING" };
  if (invitation.expires_at <= now) {
    await db.prepare("UPDATE staff_invitations SET invitation_status = 'EXPIRED' WHERE invitation_id = ? AND invitation_status = 'PENDING'").bind(invitation.invitation_id).run();
    return { ok: false, code: "INVITATION_EXPIRED" };
  }
  const existing = await getAccountContext(input.externalSubject);
  if (existing && existing.status !== "ACTIVE") return { ok: false, code: existing.status === "SUSPENDED" ? "ACCOUNT_SUSPENDED" : "ACCOUNT_CLOSED" };
  const accountId = existing?.accountId ?? crypto.randomUUID();
  const statements: D1PreparedStatement[] = [];
  if (!existing) {
    statements.push(
      db.prepare("INSERT INTO accounts (account_id, account_status, account_category, adult_confirmed, privacy_notice_version, created_at, updated_at, closed_at) VALUES (?, 'ACTIVE', 'STAFF_INVITED', 1, ?, ?, ?, NULL)").bind(accountId, input.privacyNoticeVersion, now, now),
      db.prepare("INSERT INTO account_identities (identity_id, account_id, auth_source, external_subject, verified_at, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), accountId, AUTH_SOURCE, input.externalSubject, now, now),
    );
  }
  statements.push(
    db.prepare("INSERT INTO staff_invitation_acceptance_claims (invitation_id, accepted_by_account_id, claimed_at) VALUES (?, ?, ?)").bind(invitation.invitation_id, accountId, now),
    db.prepare("INSERT OR IGNORE INTO role_assignments (role_assignment_id, account_id, role_code, assigned_by_account_id, assignment_reason, assigned_at, revoked_at) SELECT ?, ?, ?, invited_by_account_id, 'accepted_staff_invitation', ?, NULL FROM staff_invitations WHERE invitation_id = ?").bind(crypto.randomUUID(), accountId, invitation.invited_role, now, invitation.invitation_id),
  );
  if (invitation.invited_role === "ADMIN") {
    for (const permission of BOOTSTRAP_ADMIN_PERMISSIONS) {
      statements.push(db.prepare("INSERT OR IGNORE INTO permission_grants (permission_grant_id, account_id, permission_code, granted_by_account_id, grant_reason, granted_at, revoked_at) SELECT ?, ?, ?, invited_by_account_id, 'accepted_admin_invitation', ?, NULL FROM staff_invitations WHERE invitation_id = ?").bind(crypto.randomUUID(), accountId, permission, now, invitation.invitation_id));
    }
  }
  statements.push(
    db.prepare("UPDATE staff_invitations SET invitation_status = 'ACCEPTED', accepted_at = ?, accepted_by_account_id = ? WHERE invitation_id = ? AND invitation_status = 'PENDING'").bind(now, accountId, invitation.invitation_id),
    db.prepare("UPDATE staff_invitation_tokens SET consumed_at = ? WHERE invitation_id = ? AND consumed_at IS NULL").bind(now, invitation.invitation_id),
    db.prepare("INSERT INTO audit_events (audit_event_id, actor_account_id, action_code, target_type, target_id, outcome_code, reason_code, request_id, occurred_at) VALUES (?, ?, 'staff_invitation.accept', 'STAFF_INVITATION', ?, 'SUCCEEDED', ?, ?, ?)").bind(crypto.randomUUID(), accountId, invitation.invitation_id, invitation.invited_role, input.requestId, now),
  );
  try {
    await db.batch(statements);
  } catch {
    return { ok: false, code: "INVITATION_ACCEPTANCE_CONFLICT" };
  }
  const refreshed = await getAccountContext(input.externalSubject);
  if (!refreshed) throw new Error("Accepted staff account is unreadable");
  return { ok: true, value: refreshed };
}

/* درخواست حذف فقط lifecycle را ثبت می‌کند؛ purge تا تصویب سیاست نگهداری انجام نمی‌شود. */
export async function requestAccountDeletion(actor: AccountContext, requestId: string): Promise<OperationResult<{ lifecycleRequestId: string }>> {
  if (actor.status !== "ACTIVE") return { ok: false, code: "ACTIVE_ACCOUNT_REQUIRED" };
  const db = requireDb();
  const existing = await db.prepare("SELECT lifecycle_request_id FROM account_lifecycle_requests WHERE account_id = ? AND request_type = 'ACCOUNT_DELETION' AND request_status = 'REQUESTED' LIMIT 1").bind(actor.accountId).first<{ lifecycle_request_id: string }>();
  if (existing) return { ok: true, value: { lifecycleRequestId: existing.lifecycle_request_id } };
  const lifecycleRequestId = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await db.batch([
      db.prepare("INSERT INTO account_lifecycle_requests (lifecycle_request_id, account_id, request_type, request_status, requested_at, cancelled_at, completed_at, completed_by_account_id, retention_policy_version) VALUES (?, ?, 'ACCOUNT_DELETION', 'REQUESTED', ?, NULL, NULL, NULL, NULL)").bind(lifecycleRequestId, actor.accountId, now),
      db.prepare("INSERT INTO audit_events (audit_event_id, actor_account_id, action_code, target_type, target_id, outcome_code, reason_code, request_id, occurred_at) VALUES (?, ?, 'account.deletion.request', 'ACCOUNT', ?, 'SUCCEEDED', 'RETENTION_POLICY_PENDING', ?, ?)").bind(crypto.randomUUID(), actor.accountId, actor.accountId, requestId, now),
    ]);
  } catch {
    const concurrent = await db.prepare("SELECT lifecycle_request_id FROM account_lifecycle_requests WHERE account_id = ? AND request_type = 'ACCOUNT_DELETION' AND request_status = 'REQUESTED' LIMIT 1").bind(actor.accountId).first<{ lifecycle_request_id: string }>();
    if (concurrent) return { ok: true, value: { lifecycleRequestId: concurrent.lifecycle_request_id } };
    throw new Error("Account deletion request could not be recorded");
  }
  return { ok: true, value: { lifecycleRequestId } };
}

/* لغو درخواست حذف فقط درخواست باز همان حساب احرازشده را تغییر می‌دهد. */
export async function cancelAccountDeletion(actor: AccountContext, requestId: string): Promise<OperationResult> {
  const now = new Date().toISOString();
  const result = await requireDb().prepare("UPDATE account_lifecycle_requests SET request_status = 'CANCELLED', cancelled_at = ? WHERE account_id = ? AND request_type = 'ACCOUNT_DELETION' AND request_status = 'REQUESTED'").bind(now, actor.accountId).run();
  if ((result.meta.changes ?? 0) < 1) return { ok: false, code: "NO_ACTIVE_DELETION_REQUEST" };
  await recordAuditEvent({ actorAccountId: actor.accountId, actionCode: "account.deletion.cancel", targetType: "ACCOUNT", targetId: actor.accountId, outcomeCode: "SUCCEEDED", reasonCode: "USER_CANCELLED", requestId });
  return { ok: true, value: undefined };
}

/* type guard مسیرها را از پذیرش role/permission خارج از فهرست بسته منع می‌کند. */
export function isAccountRole(value: string): value is AccountRole { return ACCOUNT_ROLES.includes(value as AccountRole); }

/* type guard permission رشته آزاد را پیش از ورود به سرویس رد می‌کند. */
export function isAccountPermission(value: string): value is AccountPermission { return ACCOUNT_PERMISSIONS.includes(value as AccountPermission); }

/* type guard دعوت فقط دو نقش کارکنان را می‌پذیرد. */
export function isStaffRole(value: string): value is StaffRole { return STAFF_ROLES.includes(value as StaffRole); }

/* نسخه اطلاعیه پذیرش دعوت باید دقیقاً با نسخه جاری سرور برابر باشد. */
export function isCurrentPrivacyNotice(value: string): boolean { return value === ACCOUNT_PRIVACY_NOTICE_VERSION; }
