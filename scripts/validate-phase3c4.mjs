/** کنترل مستقل ۳C.۴: ویرایش فراداده فقط از UI، بدون schema/migration/API جدید. */
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const errors = [];
const immutableMigrations = {
  "0000_puzzling_calypso.sql": "6f3d70ba041729b955eee1dc2eabc778fb4705fe92d6f56b343dfe5e271e52dc",
  "0001_old_phil_sheldon.sql": "06340562f1bda7df5b8ff8b02d3296b73b5521da6095f87fdaae72d882eb24cf",
  "0002_daily_banshee.sql": "e3de8d2d96f325b922d70bbff8c2c7e03e746551b3b74203c8c0ce1eda154582",
  "0003_friendly_lady_bullseye.sql": "87b71e20a07655f6d4eea116c7a00ab2375cb56184e0b36e752a8e343a804411",
  "0004_typical_rick_jones.sql": "2d4623847f531ba66d76d24ef22d4b1c578d71a95d8af236b33bdbfd16c67980",
};
const immutableFiles = {
  "db/schema.ts": "0d076d92a89aa40f6c532371e03e18e4bee8aea952b1ca628bfdeec3c9166a32",
};

async function exists(path) { try { await access(path); return true; } catch { return false; } }
async function sha256(path) { return createHash("sha256").update(await readFile(path)).digest("hex"); }
function need(content, token, label) { if (!content.includes(token)) errors.push(`${label}: عبارت «${token}» وجود ندارد.`); }
function forbid(content, pattern, label) { if (pattern.test(content)) errors.push(label); }

for (const file of ["app/admin/lms/lms-resource-editors.tsx", "scripts/validate-phase3c4.mjs"]) {
  if (!await exists(join(root, file))) errors.push(`${file}: فایل الزامی پیدا نشد.`);
}
for (const [file, hash] of Object.entries(immutableMigrations)) {
  if (await sha256(join(root, "drizzle", file)) !== hash) errors.push(`${file}: migration immutable تغییر کرده است.`);
}
for (const [file, hash] of Object.entries(immutableFiles)) {
  if (await sha256(join(root, file)) !== hash) errors.push(`${file}: فاز UI نباید schema را تغییر دهد.`);
}
const migrations = (await readdir(join(root, "drizzle"))).filter((file) => /^\d{4}_.+\.sql$/u.test(file)).sort();
if (migrations.join(",") !== Object.keys(immutableMigrations).join(",")) errors.push("۳C.۴ نباید migration تازه، حذف یا بازنویسی‌شده داشته باشد.");

const editor = await readFile(join(root, "app/admin/lms/lms-resource-editors.tsx"), "utf8");
for (const token of [
  "expectedVersion: resourceVersion", "admin-lms-course-update", "admin-lms-class-update",
  "admin-lms-lesson-update", "minLength={2}", "maxLength={120}", "min={1}", "max={5_000}",
  "resourceLabel",
]) {
  need(editor, token, "ویرایشگر فراداده");
}
forbid(editor, /dangerouslySetInnerHTML|localStorage|sessionStorage|indexedDB/iu, "ویرایشگر نباید HTML ناامن یا browser storage داشته باشد.");
forbid(editor, /bodyText\s*:|\{\s*title\s*:[^}]+position/iu, "ویرایشگر جایگاه درس نباید عنوان یا متن درس را ارسال کند.");
for (const token of ["اطلاعات شخصی را در عنوان وارد نکنید", "عنوان و متن درس فقط از صفحه revision تغییر می‌کنند", "مقصد باید در همین دوره خالی باشد"]) need(editor, token, "راهنمای عملیاتی UI");

const consoleUi = await readFile(join(root, "app/admin/lms/lms-admin-console.tsx"), "utf8");
for (const token of [
  "permissions.courses", "permissions.classes", "item.status !== \"ARCHIVED\"", "item.status !== \"CLOSED\"",
  "VERSION_CONFLICT", "LESSON_POSITION_CONFLICT", "درخواست خودکار تکرار نشد", "جابه‌جایی خودکار انجام نشد",
  "LmsTitleEditor", "LessonPositionEditor",
]) need(consoleUi, token, "پنل مدیریت ۳C.۴");
forbid(consoleUi, /setTimeout\s*\(|retry\s*\(/iu, "پنل نباید درخواست تعارض‌خورده را خودکار تکرار کند.");

const routeContracts = [
  ["app/api/admin/lms/courses/[courseId]/route.ts", ["admin-lms-course-update", "title: z.string().trim().min(2).max(120)", "expectedVersion", ".strict()"]],
  ["app/api/admin/lms/classes/[classId]/route.ts", ["admin-lms-class-update", "title: z.string().trim().min(2).max(120)", "expectedVersion", ".strict()"]],
  ["app/api/admin/lms/lessons/[lessonId]/route.ts", ["admin-lms-lesson-update", "position: z.number().int().min(1).max(5_000)", "expectedVersion", ".strict()"]],
];
for (const [file, tokens] of routeContracts) {
  const route = await readFile(join(root, file), "utf8");
  for (const token of ["validateTrustedMutation", "readLimitedJson", "consumeRateLimit", "privateJson", ...tokens]) need(route, token, file);
  if (file.includes("lessons")) forbid(route, /title\s*:|bodyText\s*:/u, "PATCH جایگاه درس نباید عنوان یا متن را بپذیرد.");
}

const service = await readFile(join(root, "lib/phase3c-lms.ts"), "utf8");
const ast = ts.createSourceFile("phase3c-lms.ts", service, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
function functionSource(name) {
  const node = ast.statements.find((item) => ts.isFunctionDeclaration(item) && item.name?.text === name);
  if (!node) { errors.push(`تابع ${name} پیدا نشد.`); return ""; }
  return node.getText(ast);
}
for (const [name, permission, terminalGuard] of [
  ["updateCourse", "courses.manage", "course_status<>'ARCHIVED'"],
  ["updateClass", "classes.manage", "class_status<>'CLOSED'"],
  ["updateLesson", "courses.manage", "lesson_status<>'ARCHIVED'"],
]) {
  const source = functionSource(name);
  for (const token of ["hasFreshPermission", permission, "version=version+1", "version=?", terminalGuard, "runAuditedMutation", "CONTENT_UPDATED", "VERSION_CONFLICT"]) need(source, token, name);
  forbid(source, /runLifecycleMutation|lms_lifecycle_events/iu, `${name}: اصلاح فراداده نباید lifecycle event بسازد.`);
}

const policy = await readFile(join(root, "lib/phase3b-policy.ts"), "utf8");
need(policy, "MINOR_DATA_COLLECTION_ENABLED = false", "قفل داده کودک");
const minorRoute = await readFile(join(root, "app/api/guardian/learners/route.ts"), "utf8");
need(minorRoute, "if (!MINOR_DATA_COLLECTION_ENABLED)", "endpoint قفل‌شده کودک");
need(minorRoute, "status: 423", "endpoint قفل‌شده کودک");
forbid(minorRoute, /readLimitedJson|request\.json\s*\(|request\.text\s*\(|request\.formData\s*\(/u, "endpoint کودک نباید پیش از تصمیم حقوقی body را بخواند.");

const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
if (Number(packageJson.version.split(".")[1] ?? 0) < 7) errors.push("نسخه package نباید از 0.7.0 کمتر باشد.");
if (!packageJson.scripts.check.includes("validate-phase3c4.mjs")) errors.push("validator ۳C.۴ باید در check chain باشد.");

if (errors.length) {
  console.error(`اعتبارسنجی ۳C.۴ با ${errors.length} خطا متوقف شد:`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log("اعتبارسنجی ۳C.۴ موفق: UI نسخه‌دار، RBAC تازه، منابع نهایی، قرارداد PATCH، migrationهای immutable و قفل کودک بررسی شد.");
}
