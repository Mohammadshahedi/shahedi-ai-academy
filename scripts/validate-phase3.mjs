/**
 * کنترل مرزهای ایمنی فاز ۳A آکادمی شاهدی.
 * این اسکریپت فقط فایل‌ها را می‌خواند و تضمین می‌کند پیش‌نمایش حساب‌ها داده جمع‌آوری نکند.
 */
import { access, readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const distRoot = join(projectRoot, "dist");
const accountPagePath = join(distRoot, "account", "index.html");
const sharedSiteScriptPath = join(distRoot, "assets", "site.js");
const errors = [];

/* همه فایل‌های یک پوشه را بدون دنبال‌کردن مسیر خارج از پروژه فهرست می‌کند. */
async function walk(directory) {
  const entries = await readdir(directory);
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry);
    const info = await stat(path);
    if (info.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

/* وجود فایل را بدون تبدیل خطای نبودن فایل به توقف ناگهانی بررسی می‌کند. */
async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/* هر عبارت الزامی را با پیام قابل‌اقدام کنترل می‌کند. */
function requireText(content, expected, label) {
  if (!content.includes(expected)) errors.push(`${label}: عبارت الزامی «${expected}» وجود ندارد.`);
}

/* فایل‌های طراحی باید وجود داشته و وضعیت غیرعملیاتی ۳A را شفاف کنند. */
const requiredDocuments = [
  "docs/phase-3/architecture.md",
  "docs/phase-3/rbac.md",
  "docs/phase-3/threat-model.md",
  "docs/phase-3/openapi.yaml",
  "docs/phase-3/schema.sql",
];

for (const document of requiredDocuments) {
  const fullPath = join(projectRoot, document);
  if (!await exists(fullPath)) errors.push(`${document}: سند الزامی فاز ۳A پیدا نشد.`);
}

if (!await exists(accountPagePath)) {
  errors.push("dist/account/index.html: صفحه پیش‌نمایش حساب‌ها پیدا نشد.");
} else {
  const accountHtml = await readFile(accountPagePath, "utf8");

  /* صفحه باید RTL، صریحاً پیش‌نمایشی و فاقد کنترل دریافت داده باشد. */
  requireText(accountHtml, '<html lang="fa" dir="rtl">', "صفحه حساب‌ها");
  requireText(accountHtml, 'data-phase="3a-preview"', "صفحه حساب‌ها");
  requireText(accountHtml, "پیش‌نمایش فاز ۳A", "صفحه حساب‌ها");
  requireText(accountHtml, "حساب کاربری فعال نیست", "صفحه حساب‌ها");
  requireText(accountHtml, "دانشجوی بزرگسال", "صفحه حساب‌ها");
  requireText(accountHtml, "والد یا سرپرست", "صفحه حساب‌ها");
  requireText(accountHtml, "زیر ۱۸ سال", "صفحه حساب‌ها");
  requireText(accountHtml, "کمترین داده لازم", "صفحه حساب‌ها");

  const dataEntryElements = ["form", "input", "select", "textarea"];
  for (const tag of dataEntryElements) {
    if (new RegExp(`<${tag}\\b`, "i").test(accountHtml)) errors.push(`صفحه حساب‌ها نباید عنصر <${tag}> داشته باشد.`);
  }
  if (/contenteditable\s*=\s*["']?true/i.test(accountHtml)) errors.push("صفحه حساب‌ها نباید محتوای قابل‌ویرایش دریافت‌کننده داده داشته باشد.");

  /* فقط اسکریپت مشترک رابط مجاز است؛ اسکریپت درون‌خطی یا ماژول حساب ممنوع است. */
  const scriptTags = [...accountHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  for (const script of scriptTags) {
    const source = script[1].match(/\bsrc="([^"]+)"/i)?.[1];
    if (source !== "/assets/site.js" || script[2].trim()) errors.push("صفحه حساب‌ها فقط می‌تواند site.js مشترک را بدون اسکریپت درون‌خطی بارگذاری کند.");
  }

  const forbiddenBrowserApis = /\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB)\b/i;
  if (forbiddenBrowserApis.test(accountHtml)) errors.push("صفحه حساب‌ها شامل API ارسال شبکه یا ذخیره مرورگر است.");
  if (/(?:ثبت.?نام\s+(?:کنید|اکنون)|(?:اکنون\s+)?وارد\s+شوید)/i.test(accountHtml)) errors.push("صفحه حساب‌ها ممکن است قابلیت فعال ثبت‌نام یا ورود را القا کند.");
}

/* اگر در آینده فایل اختصاصی حساب اضافه شد، تا پایان ۳A باید محلی و بدون ذخیره بماند. */
const optionalAccountScript = join(distRoot, "assets", "account.js");
if (await exists(optionalAccountScript)) {
  const accountScript = await readFile(optionalAccountScript, "utf8");
  if (!/^\s*\/\*/.test(accountScript)) errors.push("account.js باید با توضیح روشن دامنه رفتاری آغاز شود.");
  if (/\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB)\b/.test(accountScript)) {
    errors.push("account.js در فاز ۳A نباید ارسال شبکه یا ذخیره مرورگر داشته باشد.");
  }
}

/* اسکریپت مشترکِ بارگذاری‌شده در صفحه حساب نیز نباید مسیر پنهان ارسال یا ذخیره بسازد. */
if (await exists(sharedSiteScriptPath)) {
  const sharedSiteScript = await readFile(sharedSiteScriptPath, "utf8");
  if (/\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB)\b/.test(sharedSiteScript)) {
    errors.push("site.js در فاز ۳A نباید ارسال شبکه یا ذخیره مرورگر داشته باشد.");
  }
} else {
  errors.push("dist/assets/site.js: اسکریپت مشترک صفحه حساب پیدا نشد.");
}

/* همه صفحاتی که ناوبری اصلی دارند باید لینک پیش‌نمایش حساب‌ها را ارائه کنند. */
const distFiles = await walk(distRoot);
const htmlFiles = distFiles.filter((file) => extname(file) === ".html");
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  if (html.includes('class="nav-links"') && !html.includes('href="/account/"')) {
    errors.push(`${relative(projectRoot, file)}: لینک /account/ در ناوبری اصلی وجود ندارد.`);
  }
  /* عنوان لینک باید پیش‌نمایشی‌بودن قابلیت را پیش از ورود به صفحه نیز روشن کند. */
  if (html.includes('class="nav-links"') && !html.includes('>پیش‌نمایش حساب‌ها</a>')) {
    errors.push(`${relative(projectRoot, file)}: عنوان لینک حساب‌ها ممکن است فعال‌بودن ثبت‌نام را القا کند.`);
  }
}

/* اصول معماری، RBAC و رضایت والد باید در اسناد تخصصی قابل جست‌وجو باشند. */
if (requiredDocuments.every((document) => !errors.some((error) => error.startsWith(`${document}:`)))) {
  const architecture = await readFile(join(projectRoot, "docs/phase-3/architecture.md"), "utf8");
  const rbac = await readFile(join(projectRoot, "docs/phase-3/rbac.md"), "utf8");
  const threatModel = await readFile(join(projectRoot, "docs/phase-3/threat-model.md"), "utf8");
  const openApi = await readFile(join(projectRoot, "docs/phase-3/openapi.yaml"), "utf8");
  const schema = await readFile(join(projectRoot, "docs/phase-3/schema.sql"), "utf8");

  requireText(architecture, "فاز ۳B", "architecture.md");
  requireText(architecture, "زمان بازبودن صفحه معیار یادگیری نیست", "architecture.md");
  requireText(architecture, "حساب مستقل پیش‌بینی نمی‌شود", "architecture.md");
  requireText(rbac, "رد به‌صورت پیش‌فرض", "rbac.md");
  requireText(rbac, "پیوند فعال", "rbac.md");
  for (const role of ["ADULT_STUDENT", "GUARDIAN", "INSTRUCTOR", "ADMIN"]) requireText(rbac, role, "rbac.md");
  requireText(threatModel, "اتصال جعلی سرپرست", "threat-model.md");
  requireText(threatModel, "localStorage", "threat-model.md");
  requireText(openApi, "openapi: 3.1.0", "openapi.yaml");
  requireText(openApi, "x-phase-status: design-only", "openapi.yaml");
  requireText(openApi, "securitySchemes:", "openapi.yaml");
  requireText(openApi, "MinorLearnerRequest", "openapi.yaml");
  requireText(schema, "CREATE TABLE guardian_learner_links", "schema.sql");
  requireText(schema, "CREATE TABLE consent_records", "schema.sql");
  requireText(schema, "CREATE TABLE audit_events", "schema.sql");

  /* از قفل‌شدن ناخواسته طراحی روی فروشنده یا سرویس خاص جلوگیری می‌شود. */
  const designBundle = [architecture, rbac, threatModel, openApi, schema].join("\n");
  const namedProviders = /\b(?:Firebase|Supabase|Auth0|Clerk|Keycloak|PostgreSQL|MySQL|MongoDB|Stripe)\b/i;
  if (namedProviders.test(designBundle)) errors.push("اسناد فاز ۳A نباید ارائه‌دهنده یا موتور مشخصی را انتخاب کنند.");
  if (/\b(?:password|secret|api_key)\s+(?:CHAR|VARCHAR|TEXT)/i.test(schema)) errors.push("schema.sql نباید ستون credential خام تعریف کند.");
}

if (errors.length) {
  console.error(`اعتبارسنجی فاز ۳A با ${errors.length} خطا متوقف شد:`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`اعتبارسنجی فاز ۳A موفق: ${requiredDocuments.length} سند و ${htmlFiles.length} صفحه بررسی شد؛ پیش‌نمایش فاقد جمع‌آوری داده است.`);
}
