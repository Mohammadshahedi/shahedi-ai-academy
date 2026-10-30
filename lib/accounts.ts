/** خواندن و ایجاد حساب بزرگسال با نقش حداقلی، هویت مدیریت‌شده و حسابرسی. */
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, accountIdentities, auditEvents, permissionGrants, roleAssignments } from "@/db/schema";
import type { AccountRole, SelfServiceRole } from "@/lib/phase3b-policy";

export type AccountContext = { accountId: string; status: "ACTIVE" | "SUSPENDED" | "CLOSED"; roles: AccountRole[]; permissions: string[] };
export type AccountCreationResult = { account: AccountContext; created: boolean };
type CreateAccountInput = { externalSubject: string; role: SelfServiceRole; privacyNoticeVersion: string; requestId: string };

/* نقش‌ها و مجوزها در هر درخواست از وضعیت جاری سرور خوانده می‌شوند. */
export async function getAccountContext(externalSubject: string): Promise<AccountContext | null> {
  const db = getDb();
  const [identity] = await db.select({ accountId: accountIdentities.accountId }).from(accountIdentities).where(and(eq(accountIdentities.authSource, "CHATGPT_SITES"), eq(accountIdentities.externalSubject, externalSubject))).limit(1);
  if (!identity) return null;
  const [account] = await db.select({ accountId: accounts.accountId, status: accounts.accountStatus }).from(accounts).where(eq(accounts.accountId, identity.accountId)).limit(1);
  if (!account) return null;
  const activeRoles = await db.select({ roleCode: roleAssignments.roleCode }).from(roleAssignments).where(and(eq(roleAssignments.accountId, account.accountId), isNull(roleAssignments.revokedAt)));
  const activePermissions = await db.select({ permissionCode: permissionGrants.permissionCode }).from(permissionGrants).where(and(eq(permissionGrants.accountId, account.accountId), isNull(permissionGrants.revokedAt)));
  return { accountId: account.accountId, status: account.status, roles: activeRoles.map((assignment) => assignment.roleCode), permissions: activePermissions.map((grant) => grant.permissionCode) };
}

/* ایجاد حساب و نقش پایه در یک batch انجام می‌شود؛ تکرار درخواست، حساب دوم نمی‌سازد. */
export async function createSelfServiceAccount(input: CreateAccountInput): Promise<AccountCreationResult> {
  const existing = await getAccountContext(input.externalSubject);
  if (existing) return { account: existing, created: false };
  const db = getDb();
  const now = new Date().toISOString();
  const accountId = crypto.randomUUID();
  try {
    await db.batch([
      db.insert(accounts).values({ accountId, accountStatus: "ACTIVE", accountCategory: "ADULT_SELF_SERVICE", adultConfirmed: true, privacyNoticeVersion: input.privacyNoticeVersion, createdAt: now, updatedAt: now }),
      db.insert(accountIdentities).values({ identityId: crypto.randomUUID(), accountId, authSource: "CHATGPT_SITES", externalSubject: input.externalSubject, verifiedAt: now, createdAt: now }),
      db.insert(roleAssignments).values({ roleAssignmentId: crypto.randomUUID(), accountId, roleCode: input.role, assignmentReason: "self_service_adult_onboarding", assignedAt: now }),
      db.insert(auditEvents).values({ auditEventId: crypto.randomUUID(), actorAccountId: accountId, actionCode: "account.self_service.create", targetType: "ACCOUNT", targetId: accountId, outcomeCode: "SUCCEEDED", reasonCode: input.role, requestId: input.requestId, occurredAt: now }),
    ]);
  } catch (error) {
    /* برخورد هم‌زمان unique با بازخوانی حل می‌شود؛ جزئیات D1 به کاربر نشت نمی‌کند. */
    const concurrentAccount = await getAccountContext(input.externalSubject);
    if (concurrentAccount) return { account: concurrentAccount, created: false };
    throw error;
  }
  const created = await getAccountContext(input.externalSubject);
  if (!created) throw new Error("Account creation did not produce a readable account");
  return { account: created, created: true };
}

/* رویداد رد یا توقف سیاستی بدون payload حساس ثبت می‌شود. */
export async function recordAuditEvent(input: { actorAccountId: string | null; actionCode: string; targetType: string; targetId?: string | null; outcomeCode: "SUCCEEDED" | "DENIED" | "FAILED"; reasonCode?: string | null; requestId: string }): Promise<void> {
  const db = getDb();
  await db.insert(auditEvents).values({ auditEventId: crypto.randomUUID(), actorAccountId: input.actorAccountId, actionCode: input.actionCode, targetType: input.targetType, targetId: input.targetId ?? null, outcomeCode: input.outcomeCode, reasonCode: input.reasonCode ?? null, requestId: input.requestId, occurredAt: new Date().toISOString() });
}

/* مجوزها با deny-by-default بررسی می‌شوند و نقش ADMIN میان‌بر ایجاد نمی‌کند. */
export function hasPermission(context: AccountContext, permission: string): boolean { return context.status === "ACTIVE" && context.permissions.includes(permission); }
