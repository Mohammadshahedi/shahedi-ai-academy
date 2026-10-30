/**
 * کنترل ایستا و fail-closed برش اول فاز ۳B.
 * این اسکریپت فایل‌ها را می‌خواند و هیچ حساب، migration یا داده‌ای ایجاد نمی‌کند.
 */
import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const errors = [];

/* وجود فایل‌های اجرایی لازم برای ساخت Worker و D1 را بررسی می‌کند. */
async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

/* عبارت‌های قراردادی امنیت و حریم خصوصی را در فایل هدف الزام می‌کند. */
function requireText(content, expected, label) {
  if (!content.includes(expected)) errors.push(`${label}: عبارت الزامی «${expected}» وجود ندارد.`);
}

const requiredFiles = [
  "app/account/page.tsx",
  "app/account/onboarding-form.tsx",
  "app/dashboard/page.tsx",
  "app/api/account/me/route.ts",
  "app/api/account/onboarding/route.ts",
  "app/api/guardian/learners/route.ts",
  "app/chatgpt-auth.ts",
  "db/schema.ts",
  "drizzle/0000_puzzling_calypso.sql",
  "lib/accounts.ts",
  "lib/http-security.ts",
  "lib/rate-limit.ts",
  "lib/phase3b-policy.ts",
];
for (const file of requiredFiles) if (!await exists(join(projectRoot, file))) errors.push(`${file}: فایل الزامی پیدا نشد.`);

const hosting = JSON.parse(await readFile(join(projectRoot, ".openai", "hosting.json"), "utf8"));
if (hosting.project_id !== "appgprj_6abe2f04be988191be927780936869e5") errors.push("شناسه Site موجود نباید در مهاجرت تغییر کند.");
if (hosting.d1 !== "DB") errors.push("binding پایگاه داده باید DB باشد.");
if ("static" in hosting) errors.push("manifest Worker نباید تنظیم static قبلی را نگه دارد.");

const schema = await readFile(join(projectRoot, "db", "schema.ts"), "utf8");
for (const table of ["accounts", "accountIdentities", "roleAssignments", "permissionGrants", "minorLearnerProfiles", "guardianLearnerLinks", "consentRecords", "staffInvitations", "auditEvents", "rateLimitBuckets"]) requireText(schema, `export const ${table}`, "db/schema.ts");
if (/password|credential_hash/i.test(schema)) errors.push("schema اجرایی نباید credential یا رمز عبور را ذخیره کند.");
requireText(schema, "staffInvitationTokens", "db/schema.ts");
requireText(schema, "tokenDigest", "db/schema.ts");

const auth = await readFile(join(projectRoot, "app", "chatgpt-auth.ts"), "utf8");
requireText(auth, "oai-authenticated-user-id", "chatgpt-auth.ts");
requireText(auth, "/signin-with-chatgpt", "chatgpt-auth.ts");
requireText(auth, "safeRelativeReturnPath", "chatgpt-auth.ts");

const onboarding = await readFile(join(projectRoot, "app", "api", "account", "onboarding", "route.ts"), "utf8");
for (const control of ["validateTrustedMutation", "consumeRateLimit", "z.object", "SELF_SERVICE_ROLES", "getChatGPTUser", "ACCOUNT_SUSPENDED", "ACCOUNT_CLOSED", "result.created ? 201 : 200"]) requireText(onboarding, control, "onboarding route");
if (/INSTRUCTOR|ADMIN/.test(onboarding)) errors.push("ثبت‌نام عمومی نباید نقش مدرس یا مدیر صادر کند.");

/* وضعیت حساب غیرفعال باید در API و رابط، deny-by-default باشد. */
const accountMe = await readFile(join(projectRoot, "app", "api", "account", "me", "route.ts"), "utf8");
for (const control of ["ACCOUNT_SUSPENDED", "status: 423", "ACCOUNT_CLOSED", "status: 410"]) requireText(accountMe, control, "account me route");
const dashboard = await readFile(join(projectRoot, "app", "dashboard", "page.tsx"), "utf8");
requireText(dashboard, 'account.status !== "ACTIVE"', "dashboard page");

const guardian = await readFile(join(projectRoot, "app", "api", "guardian", "learners", "route.ts"), "utf8");
requireText(guardian, "MINOR_DATA_COLLECTION_ENABLED", "guardian route");
requireText(guardian, "POLICY_GATE_NOT_APPROVED", "guardian route");
requireText(guardian, "status: 423", "guardian route");
if (/request\.json\s*\(/.test(guardian)) errors.push("مسیر کودک تا زمان قفل سیاست نباید payload درخواست را بخواند.");

const accountUi = await readFile(join(projectRoot, "app", "account", "page.tsx"), "utf8");
requireText(accountUi, "رمز عبور", "account page");
requireText(accountUi, "زیر ۱۸ سال", "account page");
requireText(accountUi, "chatGPTSignInPath", "account page");

const runtimeFiles = [schema, onboarding, accountMe, guardian, accountUi, dashboard].join("\n");
if (/localStorage|sessionStorage|indexedDB/.test(runtimeFiles)) errors.push("مسیر حساب نباید داده کاربر را در حافظه پایدار مرورگر ذخیره کند.");

if (errors.length) {
  console.error(`اعتبارسنجی فاز ۳B با ${errors.length} خطا متوقف شد:`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`اعتبارسنجی فاز ۳B موفق: ${requiredFiles.length} فایل، D1، هویت، RBAC و قفل کودک بررسی شد.`);
}
