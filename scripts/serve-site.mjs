/**
 * سرور محلی کوچک برای پیش‌نمایش dist بدون وابستگی خارجی.
 * این ابزار فقط برای توسعه است و جایگزین وب‌سرور تولید نیست.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const distRoot = resolve(import.meta.dirname, "..", "dist");
const port = Number(process.env.SHAHEDI_PREVIEW_PORT || 4173);
const mimeTypes = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };

/* مسیر درخواست را پاک‌سازی می‌کند و خروج از پوشه dist را نمی‌پذیرد. */
function safePath(pathname) {
  const decoded = decodeURIComponent(pathname.split("?", 1)[0]);
  const relativePath = normalize(decoded).replace(/^([/\\])+/, "");
  const candidate = join(distRoot, relativePath);
  return candidate === distRoot || candidate.startsWith(`${distRoot}${sep}`) ? candidate : null;
}

createServer(async (request, response) => {
  try {
    let file = safePath(request.url || "/");
    if (!file) throw new Error("مسیر نامعتبر");
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, "index.html");
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": mimeTypes[extname(file)] || "application/octet-stream", "X-Content-Type-Options": "nosniff" });
    response.end(body);
  } catch {
    const body = await readFile(join(distRoot, "404.html"));
    response.writeHead(404, { "Content-Type": "text/html; charset=utf-8", "X-Content-Type-Options": "nosniff" });
    response.end(body);
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`پیش‌نمایش آکادمی شاهدی: http://127.0.0.1:${port}`);
});
