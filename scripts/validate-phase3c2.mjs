/** کنترل مستقل ۳C.۲: migration افزایشی، matrix، optimistic lock، batch اتمیک و تاریخچه بدون PII. */
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { runInNewContext } from "node:vm";
import ts from "typescript";
const root = resolve(import.meta.dirname, ".."); const errors = [];
const immutable = {
  "0000_puzzling_calypso.sql": "6f3d70ba041729b955eee1dc2eabc778fb4705fe92d6f56b343dfe5e271e52dc",
  "0001_old_phil_sheldon.sql": "06340562f1bda7df5b8ff8b02d3296b73b5521da6095f87fdaae72d882eb24cf",
  "0002_daily_banshee.sql": "e3de8d2d96f325b922d70bbff8c2c7e03e746551b3b74203c8c0ce1eda154582",
};
async function exists(path) { try { await access(path); return true; } catch { return false; } }
function need(content, token, label) { if (!content.includes(token)) errors.push(`${label}: عبارت «${token}» وجود ندارد.`); }
const required = ["drizzle/0003_friendly_lady_bullseye.sql", "app/admin/lms/lifecycle/page.tsx", "app/api/admin/lms/lifecycle/route.ts", "docs/phase-3c/IMPLEMENTATION.md", "docs/phase-3c/OPERATIONS.md"];
for (const file of required) if (!await exists(join(root, file))) errors.push(`${file}: فایل الزامی پیدا نشد.`);

for (const [file, hash] of Object.entries(immutable)) { const value = await readFile(join(root, "drizzle", file), "utf8"); if (createHash("sha256").update(value).digest("hex") !== hash) errors.push(`${file}: migration immutable تغییر کرده است.`); }
const migrations = (await readdir(join(root, "drizzle"))).filter((file) => /^\d{4}_.+\.sql$/u.test(file)).sort();
if (migrations.slice(0,4).join(",") !== "0000_puzzling_calypso.sql,0001_old_phil_sheldon.sql,0002_daily_banshee.sql,0003_friendly_lady_bullseye.sql") errors.push("تاریخچه migration تا 0003 باید ثابت بماند.");
const migration = await readFile(join(root, "drizzle", "0003_friendly_lady_bullseye.sql"), "utf8");
for (const token of ["lms_lifecycle_events", "`version` integer DEFAULT 1 NOT NULL", "activated_at", "archived_at", "closed_at", "published_at", "completed_at", "withdrawn_at", "lms_lifecycle_events_reason_check", "lms_lifecycle_events_resource_version_unique", "lms_lifecycle_events_time_idx", "append_only_update", "append_only_delete"]) need(migration, token, "migration 0003");
if (/\b(email|body_text|title|preferred_name|guardian|minor|price|payment|grade|capacity)\b/iu.test(migration)) errors.push("migration 0003 نباید PII، محتوا، کودک یا قابلیت خارج از دامنه اضافه کند.");

const schema = await readFile(join(root, "db", "schema.ts"), "utf8");
for (const token of ["lmsLifecycleEvents", "resourceVersion", "reasonCode", "lms_lifecycle_events_reason_check", "lms_lifecycle_events_resource_version_unique", "lms_lifecycle_events_time_idx", "activatedAt", "closedAt", "publishedAt", "completedAt", "withdrawnAt", ".default(1)"]) need(schema, token, "schema lifecycle");
const policy = await readFile(join(root, "lib", "phase3b-policy.ts"), "utf8"); need(policy, "MINOR_DATA_COLLECTION_ENABLED = false", "قفل داده کودک");

const service = await readFile(join(root, "lib", "phase3c-lms.ts"), "utf8");
for (const token of ["runLifecycleMutation", "db.batch([mutation, lifecycleEvent, audit])", "runAuditedMutation", "db.batch([mutation, audit])", "isTransitionReasonAllowed", "expectedVersion", "VERSION_CONFLICT", "RESOURCE_CREATED", "CONTENT_READY", "TEMPORARY_PAUSE", "PROGRAM_CLOSED", "ENROLLMENT_COMPLETED", "ENROLLMENT_WITHDRAWN", "INSTRUCTOR_CHANGED", "ADMIN_CORRECTION", "RE_ENROLLMENT", "COURSE_HAS_OPEN_CLASSES", "CLASS_HAS_ACTIVE_RELATIONS", "ENROLLMENT_NOT_ELIGIBLE", "listLifecycleEvents", "LIMIT 26 OFFSET ?"]) need(service, token, "phase3c-lms.ts");
if (/account_identities|external_subject|email|preferred_name|minor_learner/iu.test(service)) errors.push("سرویس چرخه عمر نباید ایمیل، هویت خارجی یا داده کودک بخواند.");
const ast = ts.createSourceFile("phase3c-lms.ts", service, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
function fnNode(name) { const node = ast.statements.find((item) => ts.isFunctionDeclaration(item) && item.name?.text === name); if (!node) errors.push(`تابع ${name} پیدا نشد.`); return node; }
function fn(name) { return fnNode(name)?.getText(ast) ?? ""; }
function assertExactBatch(name, expectedNames) {
  const node = fnNode(name); if (!node) return; let exactMatches = 0;
  function visit(child) {
    if (ts.isCallExpression(child) && ts.isPropertyAccessExpression(child.expression) && child.expression.name.text === "batch" && child.arguments.length === 1 && ts.isArrayLiteralExpression(child.arguments[0])) {
      const names = child.arguments[0].elements.map((element) => ts.isIdentifier(element) ? element.text : "");
      if (names.join(",") === expectedNames.join(",")) exactMatches += 1;
    }
    if (ts.isCallExpression(child) && ts.isPropertyAccessExpression(child.expression) && ["run", "all", "first", "raw"].includes(child.expression.name.text)) errors.push(`${name}: اجرای statement خارج از batch مجاز نیست.`);
    ts.forEachChild(child, visit);
  }
  visit(node); if (exactMatches !== 1) errors.push(`${name}: باید دقیقاً یک db.batch([${expectedNames.join(", ")}]) داشته باشد.`);
}
function preparedSql(name, variableName) {
  const node = fnNode(name); if (!node) return ""; let sqlText = "";
  function visit(child) {
    if (ts.isVariableDeclaration(child) && ts.isIdentifier(child.name) && child.name.text === variableName && child.initializer && ts.isCallExpression(child.initializer) && ts.isPropertyAccessExpression(child.initializer.expression) && child.initializer.expression.name.text === "bind") {
      const prepareCall = child.initializer.expression.expression;
      if (ts.isCallExpression(prepareCall) && ts.isPropertyAccessExpression(prepareCall.expression) && prepareCall.expression.name.text === "prepare" && prepareCall.arguments[0]) sqlText = prepareCall.arguments[0].getText(ast);
    }
    ts.forEachChild(child, visit);
  }
  visit(node); return sqlText;
}
assertExactBatch("runLifecycleMutation", ["mutation", "lifecycleEvent", "audit"]);
assertExactBatch("runAuditedMutation", ["mutation", "audit"]);
for (const [helper, variable, requiredSql] of [["runLifecycleMutation", "lifecycleEvent", "INSERT INTO lms_lifecycle_events"], ["runLifecycleMutation", "audit", "INSERT INTO audit_events"], ["runAuditedMutation", "audit", "INSERT INTO audit_events"]]) {
  const sqlText = preparedSql(helper, variable); need(sqlText, requiredSql, `${helper}.${variable}`); need(sqlText, "WHERE changes()=1", `${helper}.${variable}`);
}
try {
  const matrixSource = fn("isTransitionReasonAllowed");
  const matrixJavaScript = ts.transpileModule(matrixSource, { compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 } }).outputText;
  const allowsReason = runInNewContext(`${matrixJavaScript}\nisTransitionReasonAllowed`);
  const reasons = ["CONTENT_READY", "TEMPORARY_PAUSE", "ADMIN_CORRECTION", "PROGRAM_CLOSED", "ENROLLMENT_COMPLETED", "ENROLLMENT_WITHDRAWN", "RE_ENROLLMENT", "INSTRUCTOR_CHANGED"];
  const states = { COURSE: ["DRAFT", "ACTIVE", "ARCHIVED"], CLASS: ["DRAFT", "ACTIVE", "CLOSED"], LESSON: ["DRAFT", "PUBLISHED", "ARCHIVED"], ENROLLMENT: ["ACTIVE", "COMPLETED", "WITHDRAWN"], INSTRUCTOR_ASSIGNMENT: ["ASSIGNED", "REVOKED"] };
  const allowed = new Set(); const allow = (resource, from, to, semanticReason) => { allowed.add(`${resource}|${from}|${to}|${semanticReason}`); allowed.add(`${resource}|${from}|${to}|ADMIN_CORRECTION`); };
  allow("COURSE", "DRAFT", "ACTIVE", "CONTENT_READY"); allow("COURSE", "ACTIVE", "DRAFT", "TEMPORARY_PAUSE"); allow("COURSE", "DRAFT", "ARCHIVED", "PROGRAM_CLOSED"); allow("COURSE", "ACTIVE", "ARCHIVED", "PROGRAM_CLOSED");
  allow("CLASS", "DRAFT", "ACTIVE", "CONTENT_READY"); allow("CLASS", "ACTIVE", "DRAFT", "TEMPORARY_PAUSE"); allow("CLASS", "DRAFT", "CLOSED", "PROGRAM_CLOSED"); allow("CLASS", "ACTIVE", "CLOSED", "PROGRAM_CLOSED");
  allow("LESSON", "DRAFT", "PUBLISHED", "CONTENT_READY"); allow("LESSON", "PUBLISHED", "DRAFT", "TEMPORARY_PAUSE"); allow("LESSON", "DRAFT", "ARCHIVED", "PROGRAM_CLOSED"); allow("LESSON", "PUBLISHED", "ARCHIVED", "PROGRAM_CLOSED");
  allow("ENROLLMENT", "ACTIVE", "COMPLETED", "ENROLLMENT_COMPLETED"); allow("ENROLLMENT", "ACTIVE", "WITHDRAWN", "ENROLLMENT_WITHDRAWN"); allowed.add("ENROLLMENT|COMPLETED|ACTIVE|ADMIN_CORRECTION"); allow("ENROLLMENT", "WITHDRAWN", "ACTIVE", "RE_ENROLLMENT");
  allow("INSTRUCTOR_ASSIGNMENT", "ASSIGNED", "REVOKED", "INSTRUCTOR_CHANGED");
  for (const [resource, resourceStates] of Object.entries(states)) for (const from of resourceStates) for (const to of resourceStates) for (const reason of reasons) {
    const key = `${resource}|${from}|${to}|${reason}`; if (Boolean(allowsReason(resource, from, to, reason)) !== allowed.has(key)) errors.push(`reason matrix: نتیجه نادرست برای ${key}.`);
  }
} catch (error) { errors.push(`آزمون رفتاری reason matrix شکست خورد: ${error instanceof Error ? error.message : String(error)}`); }
for (const [name, tokens] of Object.entries({
  createCourse: ["'DRAFT'", "RESOURCE_CREATED"], createClass: ["'DRAFT'", "RESOURCE_CREATED"], createLesson: ["'DRAFT'", "RESOURCE_CREATED"], enrollAdultStudent: ["'ACTIVE'", "RESOURCE_CREATED"], assignInstructor: ["ASSIGNED"],
  transitionCourse: ["course_status='DRAFT'", "course_status='ACTIVE'", "class_status<>'CLOSED'"],
  transitionClass: ["class_status='DRAFT'", "class_status='ACTIVE'", "enrollment_status='ACTIVE'", "ia.revoked_at IS NULL"],
  transitionLesson: ["lesson_status='DRAFT'", "lesson_status='PUBLISHED'", "c.course_status<>'ARCHIVED'"],
  transitionEnrollment: ["enrollment_status='ACTIVE'", "enrollment_status='COMPLETED'", "enrollment_status='WITHDRAWN'", "ADMIN_CORRECTION", "RE_ENROLLMENT", "co.audience='ADULT_ONLY'", "ADULT_STUDENT"],
  revokeInstructor: ["ASSIGNED", "REVOKED"],
})) { const source = fn(name); for (const token of tokens) need(source, token, name); }
const enrollmentTransition = fn("transitionEnrollment");
for (const token of ["if (changes === 1)", "SELECT e.version", "fresh.version !== input.expectedVersion", "ENROLLMENT_TRANSITION_DENIED", "ENROLLMENT_NOT_ELIGIBLE", "VERSION_CONFLICT"]) need(enrollmentTransition, token, "transitionEnrollment zero-row classification");
if (enrollmentTransition.indexOf("fresh.version !== input.expectedVersion") > enrollmentTransition.indexOf("ENROLLMENT_NOT_ELIGIBLE")) errors.push("transitionEnrollment باید پیش از گزارش eligibility، نسخه تازه را برای race بررسی کند.");
for (const name of ["updateCourse", "updateClass", "updateLesson"]) { const source = fn(name); need(source, "expectedVersion", `${name} optimistic lock`); need(source, "runAuditedMutation", `${name} atomic audit`); if (/course_status\s*=\s*\?|class_status\s*=\s*\?|lesson_status\s*=\s*\?/u.test(source)) errors.push(`${name}: PATCH محتوا نباید status را تغییر دهد.`); }
const history = fn("listLifecycleEvents"); for (const banned of ["body_text", "title", "student_account_id", "request_id"]) if (history.includes(banned)) errors.push(`history: خروجی نباید ${banned} داشته باشد.`); for (const token of ["actor_account_id", "hasFreshPermission", "p.permission_code=?"]) need(history, token, "history permission/actor");

const transitionRoutes = [
  "app/api/admin/lms/courses/[courseId]/transitions/route.ts", "app/api/admin/lms/classes/[classId]/transitions/route.ts", "app/api/admin/lms/lessons/[lessonId]/transitions/route.ts", "app/api/admin/lms/classes/[classId]/enrollments/[accountId]/transitions/route.ts",
];
for (const file of transitionRoutes) { const content = await readFile(join(root, file), "utf8"); for (const token of ["export async function POST", "expectedVersion", "reasonCode", "validateTrustedMutation", "readLimitedJson", "consumeRateLimit", ".strict()", "VERSION_CONFLICT"]) need(content, token, file); }
for (const file of ["app/api/admin/lms/courses/[courseId]/route.ts", "app/api/admin/lms/classes/[classId]/route.ts", "app/api/admin/lms/lessons/[lessonId]/route.ts"]) { const content = await readFile(join(root, file), "utf8"); need(content, "expectedVersion", file); if (/\bstatus\s*:\s*z\./u.test(content)) errors.push(`${file}: schema PATCH محتوا نباید status داشته باشد.`); }
for (const file of ["app/api/admin/lms/courses/route.ts", "app/api/admin/lms/classes/route.ts", "app/api/admin/lms/courses/[courseId]/lessons/route.ts"]) { const content = await readFile(join(root, file), "utf8"); if (/\bstatus\s*:\s*z\./u.test(content)) errors.push(`${file}: ساخت باید وضعیت اولیه ثابت داشته باشد.`); }
const historyRoute = await readFile(join(root, "app/api/admin/lms/lifecycle/route.ts"), "utf8"); for (const token of ["export async function GET", "privateJson", "LIFECYCLE_RESOURCE_TYPES", "listLifecycleEvents"]) need(historyRoute, token, "history GET");
const consoleSource = await readFile(join(root, "app/admin/lms/lms-admin-console.tsx"), "utf8"); for (const token of ["نسخه", "CONTENT_READY", "TEMPORARY_PAUSE", "PROGRAM_CLOSED", "ENROLLMENT_COMPLETED", "ENROLLMENT_WITHDRAWN", "INSTRUCTOR_CHANGED", "reasonCode", "VERSION_CONFLICT", "/transitions", "/admin/lms/lifecycle/", "nextLessonOffset"]) need(consoleSource, token, "lifecycle UI");
const historyPage = await readFile(join(root, "app/admin/lms/lifecycle/page.tsx"), "utf8"); for (const token of ["actorAccountId.slice", "resourceVersion", "reasonCode"]) need(historyPage, token, "history UI");

try {
  const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys=ON;"); for (const file of migrations) db.exec((await readFile(join(root, "drizzle", file), "utf8")).replaceAll("--> statement-breakpoint", "\n"));
  const actor = "00000000-0000-4000-8000-000000000001"; const course = "00000000-0000-4000-8000-000000000002";
  db.prepare("INSERT INTO accounts (account_id,account_status,account_category,adult_confirmed,privacy_notice_version,created_at,updated_at) VALUES (?,'ACTIVE','STAFF_INVITED',1,'t','t','t')").run(actor);
  db.prepare("INSERT INTO lms_courses (course_id,audience,title,course_status,created_by_account_id,created_at,updated_at) VALUES (?,'ADULT_ONLY','t','DRAFT',?,'t','t')").run(course, actor);
  const version = db.prepare("SELECT version FROM lms_courses WHERE course_id=?").get(course); if (version?.version !== 1) errors.push("migration: version پیش‌فرض منبع باید 1 باشد.");
  db.prepare("INSERT INTO lms_lifecycle_events (lifecycle_event_id,resource_type,resource_id,from_status,to_status,reason_code,resource_version,actor_account_id,request_id,occurred_at) VALUES ('e','COURSE',?,NULL,'DRAFT','RESOURCE_CREATED',1,?,'r','t')").run(course, actor);
  function reject(action, message) { try { action(); errors.push(message); } catch { /* expected */ } }
  reject(() => db.prepare("UPDATE lms_lifecycle_events SET reason_code='x' WHERE lifecycle_event_id='e'").run(), "lifecycle event باید در برابر UPDATE append-only باشد.");
  reject(() => db.prepare("DELETE FROM lms_lifecycle_events WHERE lifecycle_event_id='e'").run(), "lifecycle event باید در برابر DELETE append-only باشد.");
  reject(() => db.prepare("INSERT INTO lms_lifecycle_events (lifecycle_event_id,resource_type,resource_id,from_status,to_status,reason_code,resource_version,actor_account_id,request_id,occurred_at) VALUES ('e2','COURSE',?,'DRAFT','ACTIVE','CONTENT_READY',1,?,'r2','t2')").run(course, actor), "هر resource/version باید فقط یک lifecycle event داشته باشد.");
  reject(() => db.prepare("INSERT INTO lms_lifecycle_events (lifecycle_event_id,resource_type,resource_id,from_status,to_status,reason_code,resource_version,actor_account_id,request_id,occurred_at) VALUES ('e3','COURSE',?,'DRAFT','ACTIVE','FREE_TEXT',2,?,'r3','t3')").run(course, actor), "reason code آزاد باید در سطح دیتابیس رد شود.");
  const guardedTransition = db.prepare("UPDATE lms_courses SET course_status='ACTIVE',version=version+1 WHERE course_id=? AND version=1 AND course_status='DRAFT'");
  const raceWinner = guardedTransition.run(course); const staleRacer = guardedTransition.run(course);
  if (raceWinner.changes !== 1 || staleRacer.changes !== 0) errors.push("optimistic lock باید از دو گذار با expectedVersion یکسان دقیقاً یکی را موفق کند.");
  db.close();
} catch (error) { errors.push(`اجرای رفتاری migration 0003 شکست خورد: ${error instanceof Error ? error.message : String(error)}`); }

try {
  const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys=ON;");
  for (const file of migrations.slice(0, 3)) db.exec((await readFile(join(root, "drizzle", file), "utf8")).replaceAll("--> statement-breakpoint", "\n"));
  const actor = "10000000-0000-4000-8000-000000000001"; const student = "10000000-0000-4000-8000-000000000002";
  const draftCourse = "10000000-0000-4000-8000-000000000003"; const activeCourse = "10000000-0000-4000-8000-000000000004";
  const activeClass = "10000000-0000-4000-8000-000000000005"; const publishedLesson = "10000000-0000-4000-8000-000000000006"; const withdrawnEnrollment = "10000000-0000-4000-8000-000000000007";
  const insertAccount = db.prepare("INSERT INTO accounts (account_id,account_status,account_category,adult_confirmed,privacy_notice_version,created_at,updated_at) VALUES (?,'ACTIVE','ADULT_SELF_SERVICE',1,'t','t','t')"); insertAccount.run(actor); insertAccount.run(student);
  const insertCourse = db.prepare("INSERT INTO lms_courses (course_id,audience,title,course_status,created_by_account_id,created_at,updated_at) VALUES (?,'ADULT_ONLY','t',?,?, 't','t')"); insertCourse.run(draftCourse, "DRAFT", actor); insertCourse.run(activeCourse, "ACTIVE", actor);
  db.prepare("INSERT INTO lms_classes (class_id,course_id,title,class_status,created_by_account_id,created_at,updated_at) VALUES (?,?, 't','ACTIVE',?,'t','t')").run(activeClass, activeCourse, actor);
  db.prepare("INSERT INTO lms_lessons (lesson_id,course_id,title,body_text,position,lesson_status,created_by_account_id,created_at,updated_at) VALUES (?,?, 't','t',1,'PUBLISHED',?,'t','t')").run(publishedLesson, activeCourse, actor);
  db.prepare("INSERT INTO lms_enrollments (enrollment_id,class_id,student_account_id,enrollment_status,created_by_account_id,created_at,updated_at) VALUES (?,?,?,'WITHDRAWN',?,'t','t')").run(withdrawnEnrollment, activeClass, student, actor);
  db.exec(migration.replaceAll("--> statement-breakpoint", "\n"));
  const upgraded = db.prepare(`SELECT
    (SELECT course_status FROM lms_courses WHERE course_id=?) AS draft_status,
    (SELECT course_status FROM lms_courses WHERE course_id=?) AS active_status,
    (SELECT class_status FROM lms_classes WHERE class_id=?) AS class_status,
    (SELECT lesson_status FROM lms_lessons WHERE lesson_id=?) AS lesson_status,
    (SELECT enrollment_status FROM lms_enrollments WHERE enrollment_id=?) AS enrollment_status,
    (SELECT MIN(version) FROM lms_courses) AS course_version,
    (SELECT version FROM lms_classes WHERE class_id=?) AS class_version,
    (SELECT version FROM lms_lessons WHERE lesson_id=?) AS lesson_version,
    (SELECT version FROM lms_enrollments WHERE enrollment_id=?) AS enrollment_version,
    (SELECT COUNT(*) FROM lms_lifecycle_events) AS event_count,
    (SELECT COUNT(*) FROM lms_courses WHERE activated_at IS NOT NULL OR archived_at IS NOT NULL) AS course_timestamp_count,
    (SELECT COUNT(*) FROM lms_classes WHERE activated_at IS NOT NULL OR closed_at IS NOT NULL) AS class_timestamp_count,
    (SELECT COUNT(*) FROM lms_lessons WHERE published_at IS NOT NULL OR archived_at IS NOT NULL) AS lesson_timestamp_count,
    (SELECT COUNT(*) FROM lms_enrollments WHERE completed_at IS NOT NULL OR withdrawn_at IS NOT NULL) AS enrollment_timestamp_count`).get(draftCourse, activeCourse, activeClass, publishedLesson, withdrawnEnrollment, activeClass, publishedLesson, withdrawnEnrollment);
  const expected = { draft_status: "DRAFT", active_status: "ACTIVE", class_status: "ACTIVE", lesson_status: "PUBLISHED", enrollment_status: "WITHDRAWN", course_version: 1, class_version: 1, lesson_version: 1, enrollment_version: 1, event_count: 0, course_timestamp_count: 0, class_timestamp_count: 0, lesson_timestamp_count: 0, enrollment_timestamp_count: 0 };
  for (const [key, value] of Object.entries(expected)) if (upgraded?.[key] !== value) errors.push(`ارتقای 0003: مقدار ${key} باید ${value} باشد و backfill ساختگی رخ ندهد.`);
  db.close();
} catch (error) { errors.push(`آزمون ارتقا از 0000-0002 به 0003 شکست خورد: ${error instanceof Error ? error.message : String(error)}`); }

const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")); if (Number(packageJson.version.split(".")[1]) < 5) errors.push("نسخه package نباید از 0.5.0 کمتر باشد."); if (!packageJson.scripts.check.includes("validate-phase3c2.mjs")) errors.push("validator ۳C.۲ باید در check chain باشد.");
if (errors.length) { console.error(`اعتبارسنجی ۳C.۲ با ${errors.length} خطا متوقف شد:`); errors.forEach((error) => console.error(`- ${error}`)); process.exitCode = 1; } else console.log("اعتبارسنجی ۳C.۲ موفق: migration، matrix، batch اتمیک، optimistic lock و تاریخچه بررسی شد.");
