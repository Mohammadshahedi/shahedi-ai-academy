/**
 * کنترل ایستای فاز ۳B.2 برای migration افزایشی، دعوت تک‌مصرف، RBAC و قفل کودک.
 * این validator هیچ حساب، token، secret یا داده واقعی ایجاد نمی‌کند.
 */
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const errors = [];
const phase3b1MigrationHash = "6f3d70ba041729b955eee1dc2eabc778fb4705fe92d6f56b343dfe5e271e52dc";

/* وجود فایل بدون تبدیل نبودن آن به توقف ناگهانی بررسی می‌شود. */
async function exists(path) { try { await access(path); return true; } catch { return false; } }

/* قراردادهای امنیتی باید به‌صورت قابل‌جست‌وجو در منبع باقی بمانند. */
function requireText(content, expected, label) { if (!content.includes(expected)) errors.push(`${label}: عبارت الزامی «${expected}» وجود ندارد.`); }

const requiredFiles = [
  "app/admin/page.tsx",
  "app/admin/admin-console.tsx",
  "app/admin/bootstrap/page.tsx",
  "app/api/admin/bootstrap/route.ts",
  "app/api/admin/accounts/route.ts",
  "app/api/admin/staff-invitations/route.ts",
  "app/api/staff-invitations/accept/route.ts",
  "app/api/account/deletion-request/route.ts",
  "app/staff-invitation/page.tsx",
  "db/schema.ts",
  "drizzle/0001_old_phil_sheldon.sql",
  "lib/phase3b-admin.ts",
  "lib/phase3b-crypto.ts",
  "lib/http-security.ts",
];
for (const file of requiredFiles) if (!await exists(join(projectRoot, file))) errors.push(`${file}: فایل الزامی فاز ۳B.2 پیدا نشد.`);

/* migration ۳B.1 پس از انتشار مفهومی immutable و فقط یک migration افزایشی مجاز است. */
const migration0000 = await readFile(join(projectRoot, "drizzle", "0000_puzzling_calypso.sql"), "utf8");
const migration0000Hash = createHash("sha256").update(migration0000).digest("hex");
if (migration0000Hash !== phase3b1MigrationHash) errors.push("migration 0000 فاز ۳B.1 نباید بازنویسی شود.");
const migrationFiles = (await readdir(join(projectRoot, "drizzle"))).filter((file) => /^\d{4}_.+\.sql$/u.test(file)).sort();
if (migrationFiles.slice(0, 2).join(",") !== "0000_puzzling_calypso.sql,0001_old_phil_sheldon.sql") errors.push("migrationهای 0000 و 0001 فاز ۳B باید به همان ترتیب حفظ شوند.");
const migration0001 = await readFile(join(projectRoot, "drizzle", "0001_old_phil_sheldon.sql"), "utf8");
for (const contract of ["staff_invitation_acceptance_claims", "staff_invitation_claim_guard", "permission_grants_active_unique", "role_assignments_active_unique", "account_lifecycle_requested_unique", "retention_policy_versions"]) requireText(migration0001, contract, "migration 0001");
requireText(migration0001, "RAISE(ABORT, 'staff_invitation_not_claimable')", "migration 0001");

/* secret فقط با نام خالی در نمونه محیط و هرگز با مقدار در مخزن ثبت می‌شود. */
const envExample = await readFile(join(projectRoot, ".env.example"), "utf8");
requireText(envExample, "ACADEMY_BOOTSTRAP_SECRET=", ".env.example");
if (/ACADEMY_BOOTSTRAP_SECRET=\S+/u.test(envExample)) errors.push(".env.example نباید مقدار secret داشته باشد.");

/* سرویس مدیریت باید همه مرزهای permission، token و آخرین مدیر را حفظ کند. */
const adminService = await readFile(join(projectRoot, "lib", "phase3b-admin.ts"), "utf8");
for (const control of ["hasFreshPermission", "SELF_STATUS_CHANGE_FORBIDDEN", "SELF_ROLE_CHANGE_FORBIDDEN", "SELF_PERMISSION_CHANGE_FORBIDDEN", "staff_invitation_acceptance_claims", "BOOTSTRAP_ADMIN_PERMISSIONS", "emailBindingDigest", "INVITATION_ACCEPTANCE_CONFLICT", "INTERNAL_ID_PATTERN", "INVALID_TARGET_ID", "nextOffset"]) requireText(adminService, control, "phase3b-admin.ts");
if (/localStorage|sessionStorage|indexedDB/u.test(adminService)) errors.push("سرویس مدیریت نباید از storage مرورگر استفاده کند.");

/* محدودیت بدنه باید stream را پیش از bufferشدن payload بزرگ متوقف کند. */
const httpSecurity = await readFile(join(projectRoot, "lib", "http-security.ts"), "utf8");
for (const control of ["request.body.getReader()", "reader.cancel", "received > maxBytes"]) requireText(httpSecurity, control, "http-security.ts");
if (/request\.arrayBuffer\s*\(/u.test(httpSecurity)) errors.push("محدودیت بدنه نباید پس از buffer کامل request اعمال شود.");

const cryptoService = await readFile(join(projectRoot, "lib", "phase3b-crypto.ts"), "utf8");
for (const control of ["crypto.getRandomValues", "SHA-256", "secureSecretMatches", "normalizeVerifiedEmail"]) requireText(cryptoService, control, "phase3b-crypto.ts");

/* همه mutationهای مدیریتی باید کنترل origin/action و rate limit داشته باشند. */
const mutationRoutes = [
  "app/api/admin/bootstrap/route.ts",
  "app/api/admin/accounts/[accountId]/status/route.ts",
  "app/api/admin/accounts/[accountId]/roles/route.ts",
  "app/api/admin/accounts/[accountId]/roles/[roleCode]/route.ts",
  "app/api/admin/accounts/[accountId]/permissions/route.ts",
  "app/api/admin/accounts/[accountId]/permissions/[permissionCode]/route.ts",
  "app/api/admin/staff-invitations/route.ts",
  "app/api/admin/staff-invitations/[invitationId]/revoke/route.ts",
  "app/api/staff-invitations/accept/route.ts",
  "app/api/account/deletion-request/route.ts",
];
for (const route of mutationRoutes) {
  const content = await readFile(join(projectRoot, route), "utf8");
  requireText(content, "validateTrustedMutation", route);
  requireText(content, "consumeRateLimit", route);
}

/* مسیر کودک همچنان پیش از خواندن body با 423 قفل می‌ماند. */
const guardianRoute = await readFile(join(projectRoot, "app", "api", "guardian", "learners", "route.ts"), "utf8");
requireText(guardianRoute, "status: 423", "guardian route");
if (/request\.json\s*\(/u.test(guardianRoute)) errors.push("مسیر کودک در ۳B.2 نباید payload را بخواند.");
const policy = await readFile(join(projectRoot, "lib", "phase3b-policy.ts"), "utf8");
requireText(policy, "MINOR_DATA_COLLECTION_ENABLED = false", "phase3b-policy.ts");
requireText(policy, "ACCOUNT_PURGE_ENABLED = false", "phase3b-policy.ts");

if (errors.length) {
  console.error(`اعتبارسنجی فاز ۳B.2 با ${errors.length} خطا متوقف شد:`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`اعتبارسنجی فاز ۳B.2 موفق: ${requiredFiles.length} فایل، migration افزایشی، دعوت تک‌مصرف، RBAC و قفل کودک بررسی شد.`);
}
