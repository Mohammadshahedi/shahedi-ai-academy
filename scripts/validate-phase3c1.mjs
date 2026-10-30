/** کنترل ایستای ۳C.۱ برای LMS بزرگسالان، RBAC، migration و حفظ قفل کودک. */
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
const root = resolve(import.meta.dirname, ".."); const errors = [];
const immutable = {
  "0000_puzzling_calypso.sql": "6f3d70ba041729b955eee1dc2eabc778fb4705fe92d6f56b343dfe5e271e52dc",
  "0001_old_phil_sheldon.sql": "06340562f1bda7df5b8ff8b02d3296b73b5521da6095f87fdaae72d882eb24cf",
  "0002_daily_banshee.sql": "e3de8d2d96f325b922d70bbff8c2c7e03e746551b3b74203c8c0ce1eda154582",
};
async function exists(path) { try { await access(path); return true; } catch { return false; } }
function requireText(content, expected, label) { if (!content.includes(expected)) errors.push(`${label}: عبارت «${expected}» وجود ندارد.`); }

const required = [
  "lib/phase3c-lms.ts", "app/admin/lms/page.tsx", "app/admin/lms/lms-admin-console.tsx",
  "app/learn/page.tsx", "app/learn/classes/[classId]/page.tsx", "app/teach/page.tsx",
  "drizzle/0002_daily_banshee.sql", "docs/phase-3c/IMPLEMENTATION.md", "docs/phase-3c/OPERATIONS.md",
];
for (const file of required) if (!await exists(join(root, file))) errors.push(`${file}: فایل الزامی پیدا نشد.`);

/* تاریخچه ۳B immutable و ۳C.۱ فقط migration افزایشی 0002 دارد. */
for (const [file, expected] of Object.entries(immutable)) {
  const content = await readFile(join(root, "drizzle", file), "utf8");
  if (createHash("sha256").update(content).digest("hex") !== expected) errors.push(`${file}: migration immutable تغییر کرده است.`);
}
const migrationFiles = (await readdir(join(root, "drizzle"))).filter((file) => /^\d{4}_.+\.sql$/u.test(file)).sort();
if (migrationFiles.slice(0, 3).join(",") !== "0000_puzzling_calypso.sql,0001_old_phil_sheldon.sql,0002_daily_banshee.sql") errors.push("تاریخچه migration تا 0002 باید بدون تغییر باقی بماند.");
const migration = await readFile(join(root, "drizzle", "0002_daily_banshee.sql"), "utf8");
for (const token of ["lms_courses", "lms_classes", "lms_lessons", "lms_enrollments", "lms_class_instructor_assignments", "ADULT_ONLY", "lms_lessons_course_position_unique", "lms_enrollments_class_student_unique", "lms_class_instructor_active_unique"]) requireText(migration, token, "migration 0002");
if (/\b(price|payment|capacity|certificate|birth|medical|guardian|minor)\b/iu.test(migration)) errors.push("migration 0002 نباید داده تجاری یا کودک اضافه کند.");

/* Permissionها بسته‌اند و قفل کودک باید بدون تغییر بماند. */
const policy = await readFile(join(root, "lib", "phase3b-policy.ts"), "utf8");
for (const token of ["courses.manage", "classes.manage", "classes.assign_instructor", "enrollments.manage", "MINOR_DATA_COLLECTION_ENABLED = false"]) requireText(policy, token, "phase3b-policy.ts");

/* سرویس باید role/resource/status را در SQL کنترل و از هویت/ایمیل دوری کند. */
const service = await readFile(join(root, "lib", "phase3c-lms.ts"), "utf8");
for (const token of ["hasFreshPermission", "ADULT_STUDENT", "INSTRUCTOR", "co.audience='ADULT_ONLY'", "e.enrollment_status='ACTIVE'", "ia.revoked_at IS NULL", "lesson_status='PUBLISHED'", "isLmsId", "runAuditedMutation", "db.batch([mutation, audit])", "changes()=1"]) requireText(service, token, "phase3c-lms.ts");
if (/account_identities|external_subject|email|preferred_name|minor_learner/iu.test(service)) errors.push("سرویس LMS نباید هویت خارجی، ایمیل یا داده کودک بخواند.");

/* invariantهای حساس در محدوده تابع بررسی می‌شوند تا حضور اتفاقی یک رشته در فایل کافی نباشد. */
const sourceFile = ts.createSourceFile("phase3c-lms.ts", service, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
function functionSource(name) {
  const node = sourceFile.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
  if (!node) { errors.push(`phase3c-lms.ts: تابع ${name} پیدا نشد.`); return ""; }
  return node.getText(sourceFile);
}
const auditedMutation = functionSource("runAuditedMutation");
if (!/db\.batch\s*\(\s*\[\s*mutation\s*,\s*audit\s*\]\s*\)/u.test(auditedMutation) || !/WHERE changes\(\)\s*=\s*1/u.test(auditedMutation)) errors.push("runAuditedMutation باید تغییر و audit شرطی را در یک D1 batch نگه دارد.");
const studentClassRead = functionSource("getStudentClass");
if ((studentClassRead.match(/\.prepare\s*\(/gu) ?? []).length !== 1 || !/LEFT JOIN lms_lessons/u.test(studentClassRead)) errors.push("getStudentClass باید مجوز کلاس و درس را در یک query/snapshot بخواند.");
const createClassSource = functionSource("createClass");
if (!/'DRAFT'/u.test(createClassSource)) errors.push("کلاس باید با وضعیت امن DRAFT ساخته شود.");
const updateEnrollmentSource = functionSource("transitionEnrollment");
for (const token of ["co.course_status='ACTIVE'", "sa.account_status='ACTIVE'", "ADULT_STUDENT"]) requireText(updateEnrollmentSource, token, "transitionEnrollment eligibility");
const enrollSource = functionSource("enrollAdultStudent");
if (!/sa\.account_id\s*<>\s*\?/u.test(enrollSource)) errors.push("ثبت‌نام self-target مدیر باید در SQL رد شود.");
const overviewSource = functionSource("getAdminLmsOverview");
for (const token of ["nextCourseOffset", "nextClassOffset", "nextAssignmentOffset", "nextEnrollmentOffset", "LIMIT 26 OFFSET ?"]) requireText(overviewSource, token, "getAdminLmsOverview");
if ((overviewSource.match(/p\.permission_code\s*=/gu) ?? []).length < 6) errors.push("هر SELECT مدیریتی LMS باید permission تازه را داخل همان query کنترل کند.");
for (const name of ["listStudentClasses", "listInstructorClasses"]) {
  const content = functionSource(name); for (const token of ["LIMIT 26 OFFSET ?", "nextOffset"]) requireText(content, token, name);
}
for (const token of ["LIMIT 26 OFFSET ?", "nextLessonOffset"]) requireText(studentClassRead, token, "getStudentClass pagination");

/* همه mutationهای LMS باید کنترل یکسان مرز HTTP داشته باشند. */
const routesRoot = join(root, "app", "api", "admin", "lms");
async function walk(directory) { const output = []; for (const entry of await readdir(directory, { withFileTypes: true })) { const path = join(directory, entry.name); if (entry.isDirectory()) output.push(...await walk(path)); else if (entry.name === "route.ts") output.push(path); } return output; }
const routes = await walk(routesRoot);
if (routes.length < 10) errors.push(`تعداد routeهای مدیریت LMS نباید از 10 کمتر باشد؛ مقدار فعلی ${routes.length} است.`);
for (const route of routes) {
  const content = await readFile(route, "utf8"); const label = route.slice(root.length + 1);
  if (/export async function (POST|PATCH|DELETE)/u.test(content)) { requireText(content, "validateTrustedMutation", label); requireText(content, "readLimitedJson", label); requireText(content, "consumeRateLimit", label); requireText(content, ".strict()", label); }
  if (/dangerouslySetInnerHTML|localStorage|sessionStorage|indexedDB/iu.test(content)) errors.push(`${label}: الگوی ذخیره مرورگر یا HTML ناامن مجاز نیست.`);
}

/* صفحات دانشجو و مدرس باید به سرویس object-level متصل و خروجی متن درس امن باشد. */
const learn = await readFile(join(root, "app", "learn", "classes", "[classId]", "page.tsx"), "utf8");
requireText(learn, "getStudentClass", "student class page");
if (/dangerouslySetInnerHTML/iu.test(learn)) errors.push("student class page: متن درس نباید به HTML تبدیل شود.");
const teach = await readFile(join(root, "app", "teach", "page.tsx"), "utf8");
requireText(teach, "listInstructorClasses", "teach page"); requireText(teach, "هیچ roster، ایمیل", "teach page");
if (await exists(join(root, "app", "api", "learn"))) errors.push("self-enrollment یا API دانشجوی تغییردهنده در ۳C.۱ مجاز نیست.");
const adminConsole = await readFile(join(root, "app", "admin", "lms", "lms-admin-console.tsx"), "utf8");
for (const token of ["nextCourseOffset", "nextClassOffset", "nextLessonOffset", "nextAssignmentOffset", "nextEnrollmentOffset", "eligible-instructors", "eligible-students"]) requireText(adminConsole, token, "LMS admin pagination");
for (const [file, token] of [["app/learn/page.tsx", "nextOffset"], ["app/learn/classes/[classId]/page.tsx", "nextLessonOffset"], ["app/teach/page.tsx", "nextOffset"]]) requireText(await readFile(join(root, file), "utf8"), token, `${file} pagination`);

/* migration واقعی روی SQLite اجرا و constraintهای امنیتی/رقابتی آن تست می‌شوند. */
try {
  const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys = ON;");
  for (const file of migrationFiles) db.exec((await readFile(join(root, "drizzle", file), "utf8")).replaceAll("--> statement-breakpoint", "\n"));
  const ids = { actor: "00000000-0000-4000-8000-000000000001", student: "00000000-0000-4000-8000-000000000002", instructor: "00000000-0000-4000-8000-000000000003", course: "00000000-0000-4000-8000-000000000004", class: "00000000-0000-4000-8000-000000000005" };
  for (const id of [ids.actor, ids.student, ids.instructor]) db.prepare("INSERT INTO accounts (account_id, account_status, account_category, adult_confirmed, privacy_notice_version, created_at, updated_at) VALUES (?, 'ACTIVE', 'STAFF_INVITED', 1, 'test', 't', 't')").run(id);
  db.prepare("INSERT INTO lms_courses (course_id, audience, title, course_status, created_by_account_id, created_at, updated_at) VALUES (?, 'ADULT_ONLY', 't', 'ACTIVE', ?, 't', 't')").run(ids.course, ids.actor);
  db.prepare("INSERT INTO lms_classes (class_id, course_id, title, class_status, created_by_account_id, created_at, updated_at) VALUES (?, ?, 't', 'ACTIVE', ?, 't', 't')").run(ids.class, ids.course, ids.actor);
  function mustReject(statement, message) { try { statement(); errors.push(message); } catch { /* constraint correctly rejected */ } }
  mustReject(() => db.prepare("INSERT INTO lms_courses (course_id, audience, title, course_status, created_by_account_id, created_at, updated_at) VALUES ('bad', 'MINOR', 't', 'DRAFT', ?, 't', 't')").run(ids.actor), "migration باید audience غیر ADULT_ONLY را رد کند.");
  db.prepare("INSERT INTO lms_lessons (lesson_id, course_id, title, body_text, position, lesson_status, created_by_account_id, created_at, updated_at) VALUES ('l1', ?, 't', 't', 1, 'DRAFT', ?, 't', 't')").run(ids.course, ids.actor);
  mustReject(() => db.prepare("INSERT INTO lms_lessons (lesson_id, course_id, title, body_text, position, lesson_status, created_by_account_id, created_at, updated_at) VALUES ('l2', ?, 't', 't', 1, 'DRAFT', ?, 't', 't')").run(ids.course, ids.actor), "migration باید position تکراری درس را رد کند.");
  db.prepare("INSERT INTO lms_enrollments (enrollment_id, class_id, student_account_id, enrollment_status, created_by_account_id, created_at, updated_at) VALUES ('e1', ?, ?, 'ACTIVE', ?, 't', 't')").run(ids.class, ids.student, ids.actor);
  mustReject(() => db.prepare("INSERT INTO lms_enrollments (enrollment_id, class_id, student_account_id, enrollment_status, created_by_account_id, created_at, updated_at) VALUES ('e2', ?, ?, 'ACTIVE', ?, 't', 't')").run(ids.class, ids.student, ids.actor), "migration باید enrollment تکراری را رد کند.");
  db.prepare("INSERT INTO lms_class_instructor_assignments (assignment_id, class_id, instructor_account_id, assigned_by_account_id, assigned_at) VALUES ('a1', ?, ?, ?, 't')").run(ids.class, ids.instructor, ids.actor);
  mustReject(() => db.prepare("INSERT INTO lms_class_instructor_assignments (assignment_id, class_id, instructor_account_id, assigned_by_account_id, assigned_at) VALUES ('a2', ?, ?, ?, 't')").run(ids.class, ids.instructor, ids.actor), "migration باید assignment فعال تکراری را رد کند.");
  db.close();
} catch (error) { errors.push(`اجرای رفتاری migration شکست خورد: ${error instanceof Error ? error.message : String(error)}`); }

const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
if (Number(packageJson.version.split(".")[1] ?? 0) < 4) errors.push("نسخه package نباید از 0.4.0 کمتر باشد.");
if (!packageJson.scripts.check.includes("validate-phase3c1.mjs")) errors.push("validator ۳C.۱ باید در check chain باشد.");

if (errors.length) { console.error(`اعتبارسنجی ۳C.۱ با ${errors.length} خطا متوقف شد:`); errors.forEach((error) => console.error(`- ${error}`)); process.exitCode = 1; }
else console.log(`اعتبارسنجی ۳C.۱ موفق: ${required.length} فایل، ${routes.length} route، RBAC و migration بزرگسالان بررسی شد.`);
