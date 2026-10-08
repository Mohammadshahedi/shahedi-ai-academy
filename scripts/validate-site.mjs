/**
 * اعتبارسنجی مستقل نسخه استاتیک آکادمی شاهدی.
 * اسکریپت فقط فایل‌ها را می‌خواند و هیچ تغییری ایجاد نمی‌کند.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, normalize, relative, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const distRoot = join(projectRoot, "dist");
const errors = [];

/* همه فایل‌های پوشه انتشار را به‌صورت بازگشتی فهرست می‌کند. */
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

/* مسیرهای وب ریشه‌ای را به فایل متناظر در dist تبدیل می‌کند. */
function routeToFile(route) {
  const cleanRoute = route.split(/[?#]/, 1)[0];
  if (cleanRoute === "/") return join(distRoot, "index.html");
  const candidate = join(distRoot, cleanRoute.replace(/^\//, ""));
  return extname(candidate) ? candidate : join(candidate, "index.html");
}

const files = await walk(distRoot);
const htmlFiles = files.filter((file) => extname(file) === ".html");
const seenTitles = new Map();

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const label = relative(projectRoot, file);
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  const description = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1]?.trim();
  const h1Count = (html.match(/<h1\b/gi) || []).length;

  if (!title) errors.push(`${label}: عنوان صفحه ندارد.`);
  if (!description && !label.endsWith("404.html")) errors.push(`${label}: توضیح متا ندارد.`);
  if (h1Count !== 1) errors.push(`${label}: باید دقیقاً یک H1 داشته باشد؛ فعلاً ${h1Count} مورد دارد.`);
  if (title && seenTitles.has(title)) errors.push(`${label}: عنوان با ${seenTitles.get(title)} تکراری است.`);
  if (title) seenTitles.set(title, label);

  /* مقصد فایل‌های محلی و مسیرهای داخلی باید وجود داشته باشد. */
  const references = [...html.matchAll(/(?:href|src)="([^"]+)"/gi)].map((match) => match[1]);
  for (const reference of references) {
    if (/^(?:https?:|tel:|mailto:|data:|#)/i.test(reference)) continue;
    try {
      await stat(routeToFile(reference));
    } catch {
      errors.push(`${label}: مقصد ${reference} پیدا نشد.`);
    }
  }

  /* لینک خارجی در تب جدید باید از دسترسی به window.opener جلوگیری کند. */
  for (const match of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)) {
    if (!/rel="[^"]*noopener[^"]*"/i.test(match[0])) errors.push(`${label}: لینک target=_blank بدون noopener است.`);
  }
}

/* عبارت مصوب گواهینامه نباید با وعده قطعی جایگزین شود. */
const allText = (await Promise.all(files.filter((file) => [".html", ".md"].includes(extname(file))).map((file) => readFile(file, "utf8")))).join("\n");
const certificateText = "امکان دریافت گواهینامه از مراجع همکار، متناسب با دوره و شرایط صدور";
if (!allText.includes(certificateText)) errors.push("عبارت مصوب گواهینامه در خروجی وجود ندارد.");
if (/مشاوره و ثبت‌نام/.test(allText)) errors.push("CTA غیرواقعی «مشاوره و ثبت‌نام» هنوز وجود دارد.");

/* JavaScript نسخه فعلی نباید اطلاعات ابزار مشاوره را ارسال یا ذخیره کند. */
const siteScript = await readFile(join(distRoot, "assets", "site.js"), "utf8");
if (/\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage)\b/.test(siteScript)) errors.push("site.js شامل ارسال شبکه یا ذخیره محلی بررسی‌نشده است.");

if (errors.length) {
  console.error(`اعتبارسنجی با ${errors.length} خطا متوقف شد:`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`اعتبارسنجی موفق: ${htmlFiles.length} صفحه و ${files.length} فایل بررسی شد.`);
}
