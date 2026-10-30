/**
 * کنترل فاز ۳B.۳–آمادگی: صفحه فقط‌خواندنی مجاز است، اما دریافت داده کودک باید fail-closed بماند.
 * این validator هیچ حساب، رضایت، مدرک سرپرستی یا داده کودک ایجاد نمی‌کند.
 */
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import ts from "typescript";

const projectRoot = resolve(import.meta.dirname, "..");
const errors = [];
const migrationHashes = {
  "0000_puzzling_calypso.sql": "6f3d70ba041729b955eee1dc2eabc778fb4705fe92d6f56b343dfe5e271e52dc",
  "0001_old_phil_sheldon.sql": "06340562f1bda7df5b8ff8b02d3296b73b5521da6095f87fdaae72d882eb24cf",
};
const guardianRouteHash = "19b57bf735671dd2a77bb63900782f6699878334569b7c56bba5c681b723506c";
const readinessPageHash = "a1f3410f7f3cf9be57789be330631f07980d227c3770daa7c4e19e4d6c9c3e99";

async function exists(path) { try { await access(path); return true; } catch { return false; } }
function requireText(content, expected, label) { if (!content.includes(expected)) errors.push(`${label}: عبارت الزامی «${expected}» وجود ندارد.`); }
function parseTypeScript(content, fileName) { return ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function findExportedConstInitializer(sourceFile, name) {
  const matches = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const isExported = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    const isConst = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
    if (!isExported || !isConst) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) matches.push(declaration.initializer);
    }
  }
  return { count: matches.length, initializer: matches[0] };
}
function isCall(node, objectName, propertyName, argument) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
  const receiver = node.expression.expression.getText();
  const property = node.expression.name.text;
  return receiver === objectName && property === propertyName && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === argument;
}
function isDirectCall(node, functionName, secondArgument) {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === functionName
    && node.arguments.length === 2 && node.arguments[0].getText() === "account"
    && ts.isStringLiteral(node.arguments[1]) && node.arguments[1].text === secondArgument;
}
function unwrapAssertion(node) { return node && (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) ? node.expression : node; }
function objectStringProperty(node, name) {
  if (!ts.isObjectLiteralExpression(node)) return undefined;
  const property = node.properties.find((item) => ts.isPropertyAssignment(item) && item.name.getText() === name);
  return property && ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer) ? property.initializer.text : undefined;
}

const requiredFiles = [
  "app/admin/minor-readiness/page.tsx",
  "app/api/guardian/learners/route.ts",
  "lib/phase3b-policy.ts",
  "docs/phase-3b/IMPLEMENTATION.md",
  "docs/phase-3b/OPERATIONS.md",
];
for (const file of requiredFiles) if (!await exists(join(projectRoot, file))) errors.push(`${file}: فایل الزامی آمادگی ۳B.۳ پیدا نشد.`);

/* در فاز آمادگی، schema و migrationهای اعمال‌شده نباید تغییر یا گسترش پیدا کنند. */
const migrationFiles = (await readdir(join(projectRoot, "drizzle"))).filter((file) => /^\d{4}_.+\.sql$/u.test(file)).sort();
if (!Object.keys(migrationHashes).every((file) => migrationFiles.includes(file))) errors.push("migrationهای immutable فاز ۳B باید حفظ شوند؛ فازهای بعدی فقط migration افزایشی می‌افزایند.");
for (const [file, expectedHash] of Object.entries(migrationHashes)) {
  const content = await readFile(join(projectRoot, "drizzle", file), "utf8");
  const actualHash = createHash("sha256").update(content).digest("hex");
  if (actualHash !== expectedHash) errors.push(`${file}: migration اعمال‌شده immutable است.`);
}

/* feature gate و وضعیت کلی فقط با مقدار ثابت بسته قابل انتشار هستند. */
const policy = await readFile(join(projectRoot, "lib", "phase3b-policy.ts"), "utf8");
const policyAst = parseTypeScript(policy, "phase3b-policy.ts");
const collectionGateExport = findExportedConstInitializer(policyAst, "MINOR_DATA_COLLECTION_ENABLED");
if (collectionGateExport.count !== 1 || !collectionGateExport.initializer || collectionGateExport.initializer.kind !== ts.SyntaxKind.FalseKeyword) errors.push("phase3b-policy.ts: feature gate باید یک export const یکتا با مقدار واقعی false باشد.");
const readinessStatusExport = findExportedConstInitializer(policyAst, "MINOR_READINESS_STATUS");
const readinessStatus = readinessStatusExport.initializer;
if (readinessStatusExport.count !== 1 || !readinessStatus || (!ts.isAsExpression(readinessStatus) && !ts.isStringLiteral(readinessStatus))) errors.push("phase3b-policy.ts: وضعیت readiness باید یک export const یکتا و literal بسته باشد.");
else {
  const statusLiteral = ts.isAsExpression(readinessStatus) ? readinessStatus.expression : readinessStatus;
  if (!ts.isStringLiteral(statusLiteral) || statusLiteral.text !== "BLOCKED") errors.push("phase3b-policy.ts: وضعیت واقعی readiness باید BLOCKED باشد.");
}
for (const decision of ["DATA_RESIDENCY", "RETENTION_POLICY", "GUARDIAN_VERIFICATION", "CONSENT_NOTICE", "DISPUTE_WORKFLOW", "INCIDENT_OWNER"]) requireText(policy, decision, "phase3b-policy.ts");
const readinessItemsExport = findExportedConstInitializer(policyAst, "MINOR_READINESS_ITEMS");
const readinessItems = unwrapAssertion(readinessItemsExport.initializer);
const requiredReadinessStates = new Map([
  ["MANAGED_IDENTITY", "READY"],
  ["DATA_RESIDENCY", "BLOCKED"],
  ["RETENTION_POLICY", "BLOCKED"],
  ["GUARDIAN_VERIFICATION", "BLOCKED"],
  ["CONSENT_NOTICE", "BLOCKED"],
  ["DISPUTE_WORKFLOW", "BLOCKED"],
  ["INCIDENT_OWNER", "BLOCKED"],
]);
if (readinessItemsExport.count !== 1 || !readinessItems || !ts.isArrayLiteralExpression(readinessItems) || readinessItems.elements.length !== requiredReadinessStates.size) {
  errors.push("phase3b-policy.ts: فهرست readiness باید یک export const یکتا با هفت تصمیم ثابت باشد.");
} else {
  const observed = new Map(readinessItems.elements.map((item) => [objectStringProperty(item, "code"), objectStringProperty(item, "state")]));
  for (const [code, state] of requiredReadinessStates) if (observed.get(code) !== state) errors.push(`phase3b-policy.ts: وضعیت واقعی ${code} باید ${state} باشد.`);
}

/* endpoint کودک باید پیش از هر نوع خواندن body با 423 متوقف بماند. */
const guardianRoute = await readFile(join(projectRoot, "app", "api", "guardian", "learners", "route.ts"), "utf8");
const actualGuardianRouteHash = createHash("sha256").update(guardianRoute).digest("hex");
if (actualGuardianRouteHash !== guardianRouteHash) errors.push("guardian route: مسیر fail-closed فقط پس از بازبینی امنیتی و به‌روزرسانی hash قابل تغییر است.");
requireText(guardianRoute, "MINOR_POLICY_APPROVAL_REQUIRED", "guardian route");
requireText(guardianRoute, "status: 423", "guardian route");
for (const forbidden of [/request\.(?:json|text|formData|arrayBuffer|blob)\s*\(/u, /request\.body/u, /readLimitedJson/u, /preferred_name|date_of_birth|medical|address|identity_document/iu]) {
  if (forbidden.test(guardianRoute)) errors.push(`guardian route: الگوی ممنوع «${forbidden}» پیدا شد.`);
}
if (/export\s+async\s+function\s+(?:GET|PUT|PATCH|DELETE)/u.test(guardianRoute)) errors.push("guardian route: مسیر اضافی داده کودک در فاز آمادگی مجاز نیست.");

/* صفحه آمادگی باید محافظت‌شده، فقط‌خواندنی و بدون ابزار ثبت تصمیم باشد. */
const readinessPage = await readFile(join(projectRoot, "app", "admin", "minor-readiness", "page.tsx"), "utf8");
const actualReadinessPageHash = createHash("sha256").update(readinessPage).digest("hex");
if (actualReadinessPageHash !== readinessPageHash) errors.push("minor readiness page: صفحه محافظت‌شده فقط پس از بازبینی امنیتی و به‌روزرسانی hash قابل تغییر است.");
for (const control of ["requireChatGPTUser", "MINOR_READINESS_ITEMS", "MINOR_DATA_COLLECTION_ENABLED", "این مرحله اجرای کامل ۳B.۳ نیست"]) requireText(readinessPage, control, "minor readiness page");
const readinessAst = parseTypeScript(readinessPage, "minor-readiness/page.tsx");
let guardedByAdminAndPermission = false;
function inspectReadinessAuth(node) {
  if (ts.isIfStatement(node) && ts.isBinaryExpression(node.expression) && node.expression.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
    const conditions = [node.expression.left, node.expression.right];
    const deniesNonAdmin = conditions.some((condition) => ts.isPrefixUnaryExpression(condition) && condition.operator === ts.SyntaxKind.ExclamationToken && isCall(condition.operand, "account.roles", "includes", "ADMIN"));
    const deniesMissingPermission = conditions.some((condition) => ts.isPrefixUnaryExpression(condition) && condition.operator === ts.SyntaxKind.ExclamationToken && isDirectCall(condition.operand, "hasPermission", "guardian_links.review"));
    if (deniesNonAdmin && deniesMissingPermission) guardedByAdminAndPermission = true;
  }
  ts.forEachChild(node, inspectReadinessAuth);
}
inspectReadinessAuth(readinessAst);
if (!guardedByAdminAndPermission) errors.push("minor readiness page: guard واقعی باید نقش ADMIN و permission guardian_links.review را هم‌زمان enforce کند.");
for (const forbidden of [/<form\b/iu, /<input\b/iu, /<textarea\b/iu, /<button\b/iu, /\bfetch\s*\(/u, /localStorage|sessionStorage|indexedDB/u]) {
  if (forbidden.test(readinessPage)) errors.push(`minor readiness page: صفحه فقط‌خواندنی نباید الگوی «${forbidden}» داشته باشد.`);
}

/* مستندات باید مرز صریح readiness را حفظ کنند و فعال‌سازی را ادعا نکنند. */
const handoff = await readFile(join(projectRoot, "PROJECT_HANDOFF.md"), "utf8");
const readme = await readFile(join(projectRoot, "README.md"), "utf8");
for (const [content, label] of [[handoff, "PROJECT_HANDOFF.md"], [readme, "README.md"]]) {
  requireText(content, "۳B.۳–آماده‌سازی", label);
  requireText(content, "423", label);
}

if (errors.length) {
  console.error(`اعتبارسنجی آمادگی ۳B.۳ با ${errors.length} خطا متوقف شد:`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`اعتبارسنجی آمادگی ۳B.۳ موفق: ${requiredFiles.length} فایل، دو migration immutable و قفل بدون خواندن payload بررسی شد.`);
}
