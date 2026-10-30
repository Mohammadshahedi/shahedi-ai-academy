/** کنترل مستقل ۳C.۳: revisionهای immutable، انتشار اتمیک، ownership و خواندن pointerمحور دانشجو. */
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const errors = [];
const immutable = {
  "0000_puzzling_calypso.sql": "6f3d70ba041729b955eee1dc2eabc778fb4705fe92d6f56b343dfe5e271e52dc",
  "0001_old_phil_sheldon.sql": "06340562f1bda7df5b8ff8b02d3296b73b5521da6095f87fdaae72d882eb24cf",
  "0002_daily_banshee.sql": "e3de8d2d96f325b922d70bbff8c2c7e03e746551b3b74203c8c0ce1eda154582",
  "0003_friendly_lady_bullseye.sql": "87b71e20a07655f6d4eea116c7a00ab2375cb56184e0b36e752a8e343a804411",
};

async function exists(path) { try { await access(path); return true; } catch { return false; } }
function need(content, token, label) { if (!content.includes(token)) errors.push(`${label}: عبارت «${token}» وجود ندارد.`); }
function reject(action, message) { try { action(); errors.push(message); } catch { /* expected */ } }

const required = [
  "drizzle/0004_typical_rick_jones.sql",
  "app/admin/lms/lessons/[lessonId]/revisions/page.tsx",
  "app/admin/lms/lessons/[lessonId]/revisions/revision-console.tsx",
  "app/api/admin/lms/lessons/[lessonId]/revisions/route.ts",
  "app/api/admin/lms/lessons/[lessonId]/revisions/[revisionId]/publish/route.ts",
];
for (const file of required) if (!await exists(join(root, file))) errors.push(`${file}: فایل الزامی پیدا نشد.`);

for (const [file, hash] of Object.entries(immutable)) {
  const value = await readFile(join(root, "drizzle", file));
  if (createHash("sha256").update(value).digest("hex") !== hash) errors.push(`${file}: migration immutable تغییر کرده است.`);
}
const migrations = (await readdir(join(root, "drizzle"))).filter((file) => /^\d{4}_.+\.sql$/u.test(file)).sort();
if (migrations.join(",") !== "0000_puzzling_calypso.sql,0001_old_phil_sheldon.sql,0002_daily_banshee.sql,0003_friendly_lady_bullseye.sql,0004_typical_rick_jones.sql") errors.push("۳C.۳ باید فقط migration افزایشی 0004 را اضافه کند.");
const migration = await readFile(join(root, "drizzle", "0004_typical_rick_jones.sql"), "utf8");
for (const token of ["lms_lesson_revisions", "lms_lesson_publications", "published_revision_id", "lms_lesson_revisions_lesson_time_idx", "lms_lesson_publications_lesson_version_unique", "lms_lesson_publications_lesson_time_idx", "NEW.lesson_version < 1", "CONTENT_UPDATE", "CONTENT_ROLLBACK", "append_only_update", "append_only_delete", "published revision ownership mismatch", "invalid lesson publication"]) need(migration, token, "migration 0004");
if (/INSERT INTO `?lms_lesson_(revisions|publications)`?/iu.test(migration)) errors.push("migration 0004 نباید revision یا publication مصنوعی backfill کند.");
if (/\b(email|external_subject|preferred_name|guardian|minor|price|payment|grade|capacity)\b/iu.test(migration)) errors.push("migration 0004 نباید PII، کودک یا قابلیت خارج از دامنه اضافه کند.");

const schema = await readFile(join(root, "db", "schema.ts"), "utf8");
for (const token of ["lmsLessonRevisions", "lmsLessonPublications", "publishedRevisionId", "CONTENT_UPDATE", "CONTENT_ROLLBACK", "lms_lesson_publications_lesson_version_unique"]) need(schema, token, "schema 3C.3");
const policy = await readFile(join(root, "lib", "phase3b-policy.ts"), "utf8");
need(policy, "MINOR_DATA_COLLECTION_ENABLED = false", "قفل داده کودک");

const service = await readFile(join(root, "lib", "phase3c-lms.ts"), "utf8");
if (/account_identities|external_subject|email|preferred_name|minor_learner/iu.test(service)) errors.push("سرویس revision نباید هویت خارجی، ایمیل یا داده کودک بخواند.");
const ast = ts.createSourceFile("phase3c-lms.ts", service, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
function functionNode(name) { const node = ast.statements.find((item) => ts.isFunctionDeclaration(item) && item.name?.text === name); if (!node) errors.push(`تابع ${name} پیدا نشد.`); return node; }
function functionSource(name) { return functionNode(name)?.getText(ast) ?? ""; }
function preparedSql(functionName, variableName) {
  const node = functionNode(functionName); if (!node) return ""; let sqlText = "";
  function visit(child) {
    if (ts.isVariableDeclaration(child) && ts.isIdentifier(child.name) && child.name.text === variableName && child.initializer && ts.isCallExpression(child.initializer) && ts.isPropertyAccessExpression(child.initializer.expression) && child.initializer.expression.name.text === "bind") {
      const prepareCall = child.initializer.expression.expression;
      if (ts.isCallExpression(prepareCall) && ts.isPropertyAccessExpression(prepareCall.expression) && prepareCall.expression.name.text === "prepare" && prepareCall.arguments[0]) sqlText = prepareCall.arguments[0].getText(ast);
    }
    ts.forEachChild(child, visit);
  }
  visit(node); return sqlText;
}
function assertExactBatch(functionName, expectedNames) {
  const node = functionNode(functionName); if (!node) return; let matches = 0;
  function visit(child) {
    if (ts.isCallExpression(child) && ts.isPropertyAccessExpression(child.expression) && child.expression.name.text === "batch" && child.arguments.length === 1 && ts.isArrayLiteralExpression(child.arguments[0])) {
      const names = child.arguments[0].elements.map((element) => ts.isIdentifier(element) ? element.text : "");
      if (names.join(",") === expectedNames.join(",")) matches += 1;
    }
    ts.forEachChild(child, visit);
  }
  visit(node); if (matches !== 1) errors.push(`${functionName}: باید دقیقاً یک db.batch([${expectedNames.join(", ")}]) داشته باشد.`);
}

const createRevision = functionSource("createLessonRevision");
for (const token of ["runAuditedMutation", "l.lesson_status<>'ARCHIVED'", "c.course_status<>'ARCHIVED'", "p.permission_code='courses.manage'"]) need(createRevision, token, "createLessonRevision");
const listRevisions = functionSource("listLessonRevisions");
for (const token of ["LIMIT 26 OFFSET ?", "last_published_at", "p.permission_code='courses.manage'", "hasFreshPermission"]) need(listRevisions, token, "listLessonRevisions");
if ((listRevisions.match(/p\.permission_code='courses\.manage'/gu) ?? []).length < 2) errors.push("listLessonRevisions باید permission تازه را داخل هر query محتوایی کنترل کند.");
const publishRevision = functionSource("publishLessonRevision");
for (const token of ["expectedLessonVersion", "owns_revision", "was_published", "REVISION_PUBLISH_DENIED", "REVISION_ALREADY_PUBLISHED", "INVALID_PUBLICATION_REASON", "fresh.version !== input.expectedLessonVersion", "VERSION_CONFLICT"]) need(publishRevision, token, "publishLessonRevision");
assertExactBatch("publishLessonRevision", ["mutation", "publication", "audit"]);
const publicationSql = preparedSql("publishLessonRevision", "publication");
const auditSql = preparedSql("publishLessonRevision", "audit");
const mutationSql = preparedSql("publishLessonRevision", "mutation");
for (const token of ["published_revision_id=?", "title=(SELECT title", "body_text=(SELECT body_text", "version=version+1", "version=?", "r.lesson_id=lms_lessons.lesson_id", "p.permission_code='courses.manage'"]) need(mutationSql, token, "publishLessonRevision mutation");
for (const [label, sqlText] of [["publication", publicationSql], ["audit", auditSql]]) { need(sqlText, "WHERE changes()=1", `publishLessonRevision ${label}`); if (/body_text|SELECT title/iu.test(sqlText)) errors.push(`publishLessonRevision ${label}: متن محتوا نباید در metadata یا audit کپی شود.`); }
const transitionLesson = functionSource("transitionLesson");
need(transitionLesson, "published_revision_id IS NOT NULL", "transitionLesson atomic publish gate");
const studentRead = functionSource("getStudentClass");
for (const token of ["LEFT JOIN lms_lesson_revisions pr ON pr.revision_id=l.published_revision_id AND pr.lesson_id=l.lesson_id", "CASE WHEN l.published_revision_id IS NULL THEN l.title ELSE pr.title END", "CASE WHEN l.published_revision_id IS NULL THEN l.body_text ELSE pr.body_text END", "owned.revision_id=l.published_revision_id AND owned.lesson_id=l.lesson_id"]) need(studentRead, token, "student pointer read");

const revisionRoute = await readFile(join(root, "app/api/admin/lms/lessons/[lessonId]/revisions/route.ts"), "utf8");
for (const token of ["export async function GET", "export async function POST", "validateTrustedMutation", "readLimitedJson", "consumeRateLimit", ".strict()", "privateJson", "20_000"]) need(revisionRoute, token, "revision route");
const publishRoute = await readFile(join(root, "app/api/admin/lms/lessons/[lessonId]/revisions/[revisionId]/publish/route.ts"), "utf8");
for (const token of ["expectedLessonVersion", "CONTENT_UPDATE", "CONTENT_ROLLBACK", "validateTrustedMutation", "readLimitedJson", "consumeRateLimit", ".strict()", "VERSION_CONFLICT"]) need(publishRoute, token, "publish route");
const patchRoute = await readFile(join(root, "app/api/admin/lms/lessons/[lessonId]/route.ts"), "utf8");
if (/title\s*:|bodyText\s*:/u.test(patchRoute)) errors.push("PATCH درس نباید عنوان یا متن را بپذیرد.");
for (const token of ["position", "expectedVersion", ".strict()"] ) need(patchRoute, token, "lesson PATCH");
const revisionUi = await readFile(join(root, "app/admin/lms/lessons/[lessonId]/revisions/revision-console.tsx"), "utf8");
for (const token of ["lastPublishedAt", "CONTENT_UPDATE", "CONTENT_ROLLBACK", "VERSION_CONFLICT", "window.confirm", "createdByAccountId.slice", "publishedRevisionId", "nextOffset"]) need(revisionUi, token, "revision UI");
if (/dangerouslySetInnerHTML|localStorage|sessionStorage|indexedDB/iu.test(revisionUi)) errors.push("UI revision نباید HTML ناامن یا browser storage داشته باشد.");

try {
  const clean = new DatabaseSync(":memory:"); clean.exec("PRAGMA foreign_keys=ON;");
  for (const file of migrations) clean.exec((await readFile(join(root, "drizzle", file), "utf8")).replaceAll("--> statement-breakpoint", "\n"));
  const tables = clean.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('lms_lesson_revisions','lms_lesson_publications') ORDER BY name").all();
  if (tables.length !== 2) errors.push("DB تمیز باید هر دو جدول ۳C.۳ را بسازد."); clean.close();
} catch (error) { errors.push(`اجرای migrationهای 0000 تا 0004 روی DB تمیز شکست خورد: ${error instanceof Error ? error.message : String(error)}`); }

try {
  const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys=ON;");
  for (const file of migrations.slice(0, 4)) db.exec((await readFile(join(root, "drizzle", file), "utf8")).replaceAll("--> statement-breakpoint", "\n"));
  const actor = "30000000-0000-4000-8000-000000000001"; const courseOne = "30000000-0000-4000-8000-000000000002"; const courseTwo = "30000000-0000-4000-8000-000000000003";
  const lessonOne = "30000000-0000-4000-8000-000000000004"; const lessonTwo = "30000000-0000-4000-8000-000000000005";
  db.prepare("INSERT INTO accounts (account_id,account_status,account_category,adult_confirmed,privacy_notice_version,created_at,updated_at) VALUES (?,'ACTIVE','STAFF_INVITED',1,'t','t','t')").run(actor);
  const insertCourse = db.prepare("INSERT INTO lms_courses (course_id,audience,title,course_status,created_by_account_id,created_at,updated_at) VALUES (?,'ADULT_ONLY','c','ACTIVE',?,'t','t')"); insertCourse.run(courseOne, actor); insertCourse.run(courseTwo, actor);
  const insertLesson = db.prepare("INSERT INTO lms_lessons (lesson_id,course_id,title,body_text,position,lesson_status,created_by_account_id,created_at,updated_at) VALUES (?,?,?, ?,1,?,?, 't','t')");
  insertLesson.run(lessonOne, courseOne, "legacy", "legacy body", "PUBLISHED", actor); insertLesson.run(lessonTwo, courseTwo, "draft", "draft body", "DRAFT", actor);
  db.exec(migration.replaceAll("--> statement-breakpoint", "\n"));
  const legacy = db.prepare("SELECT title,body_text,published_revision_id FROM lms_lessons WHERE lesson_id=?").get(lessonOne);
  if (legacy?.title !== "legacy" || legacy?.body_text !== "legacy body" || legacy?.published_revision_id !== null) errors.push("ارتقای 0004 نباید محتوای legacy یا pointer مصنوعی بسازد.");
  if (db.prepare("SELECT COUNT(*) count FROM lms_lesson_revisions").get().count !== 0 || db.prepare("SELECT COUNT(*) count FROM lms_lesson_publications").get().count !== 0) errors.push("ارتقای 0004 نباید revision/publication backfill کند.");
  const legacyView = db.prepare("SELECT CASE WHEN l.published_revision_id IS NULL THEN l.title ELSE r.title END title FROM lms_lessons l LEFT JOIN lms_lesson_revisions r ON r.revision_id=l.published_revision_id AND r.lesson_id=l.lesson_id WHERE l.lesson_id=?").get(lessonOne);
  if (legacyView?.title !== "legacy") errors.push("fallback محتوای legacy پس از migration شکسته است.");

  const revisionOne = "30000000-0000-4000-8000-000000000006"; const revisionDraft = "30000000-0000-4000-8000-000000000007"; const revisionOther = "30000000-0000-4000-8000-000000000008";
  const insertRevision = db.prepare("INSERT INTO lms_lesson_revisions (revision_id,lesson_id,title,body_text,created_by_account_id,created_at) VALUES (?,?,?,?,?,?)");
  insertRevision.run(revisionOne, lessonOne, "published", "pointer truth", actor, "t1"); insertRevision.run(revisionDraft, lessonOne, "hidden draft", "must stay hidden", actor, "t2"); insertRevision.run(revisionOther, lessonTwo, "other lesson", "other body", actor, "t3");
  reject(() => insertRevision.run("30000000-0000-4000-8000-000000000009", lessonOne, "x", "body", actor, "t4"), "عنوان کوتاه revision باید در DB رد شود.");
  reject(() => db.prepare("UPDATE lms_lessons SET published_revision_id=? WHERE lesson_id=?").run(revisionOther, lessonOne), "pointer به revision درس دیگر باید در DB رد شود.");
  db.prepare("UPDATE lms_lessons SET published_revision_id=? WHERE lesson_id=?").run(revisionOne, lessonOne);
  const pointerView = db.prepare("SELECT CASE WHEN l.published_revision_id IS NULL THEN l.title ELSE r.title END title,CASE WHEN l.published_revision_id IS NULL THEN l.body_text ELSE r.body_text END body FROM lms_lessons l LEFT JOIN lms_lesson_revisions r ON r.revision_id=l.published_revision_id AND r.lesson_id=l.lesson_id WHERE l.lesson_id=?").get(lessonOne);
  if (pointerView?.title !== "published" || pointerView?.body !== "pointer truth") errors.push("خواندن pointer نباید base یا revision پیش‌نویس را افشا کند.");

  const publication = db.prepare("INSERT INTO lms_lesson_publications (publication_id,lesson_id,revision_id,lesson_version,reason_code,published_by_account_id,published_at) VALUES (?,?,?,?,?,?,?)");
  publication.run("30000000-0000-4000-8000-000000000010", lessonOne, revisionOne, 2, "CONTENT_UPDATE", actor, "p1");
  reject(() => publication.run("30000000-0000-4000-8000-000000000011", lessonOne, revisionDraft, 2, "CONTENT_UPDATE", actor, "p2"), "هر lesson/version فقط یک publication باید داشته باشد.");
  reject(() => publication.run("30000000-0000-4000-8000-000000000012", lessonOne, revisionOther, 3, "CONTENT_ROLLBACK", actor, "p3"), "publication با revision درس دیگر باید رد شود.");
  reject(() => publication.run("30000000-0000-4000-8000-000000000013", lessonOne, revisionDraft, 3, "FREE_TEXT", actor, "p4"), "reason آزاد publication باید رد شود.");
  reject(() => publication.run("30000000-0000-4000-8000-000000000014", lessonOne, revisionDraft, 0, "CONTENT_UPDATE", actor, "p5"), "نسخه نامعتبر publication باید رد شود.");
  for (const [statement, message] of [
    ["UPDATE lms_lesson_revisions SET title='changed'", "revision در برابر UPDATE append-only نیست."],
    ["DELETE FROM lms_lesson_revisions", "revision در برابر DELETE append-only نیست."],
    ["UPDATE lms_lesson_publications SET reason_code='CONTENT_ROLLBACK'", "publication در برابر UPDATE append-only نیست."],
    ["DELETE FROM lms_lesson_publications", "publication در برابر DELETE append-only نیست."],
  ]) reject(() => db.exec(statement), message);
  const guardedPublish = db.prepare("UPDATE lms_lessons SET published_revision_id=?,version=version+1 WHERE lesson_id=? AND version=1");
  const winner = guardedPublish.run(revisionOther, lessonTwo); const stale = guardedPublish.run(revisionOther, lessonTwo);
  if (winner.changes !== 1 || stale.changes !== 0) errors.push("دو انتشار با expectedVersion یکسان باید دقیقاً یک برنده داشته باشند.");
  db.close();
} catch (error) { errors.push(`آزمون رفتاری upgrade/ownership/append-only شکست خورد: ${error instanceof Error ? error.message : String(error)}`); }

const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
if (Number(packageJson.version.split(".")[1] ?? 0) < 6) errors.push("نسخه package نباید از 0.6.0 کمتر باشد.");
if (!packageJson.scripts.check.includes("validate-phase3c3.mjs")) errors.push("validator ۳C.۳ باید در check chain باشد.");

if (errors.length) {
  console.error(`اعتبارسنجی ۳C.۳ با ${errors.length} خطا متوقف شد:`);
  errors.forEach((error) => console.error(`- ${error}`)); process.exitCode = 1;
} else console.log("اعتبارسنجی ۳C.۳ موفق: revision، publication، ownership، race و خواندن pointer بررسی شد.");
