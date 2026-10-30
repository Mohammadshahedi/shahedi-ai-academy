/** صفحات معرفی تثبیت‌شده را بدون بازنویسی محتوایی از Worker پاسخ می‌دهد. */
import homeHtml from "@/legacy-static/index.html?raw";
import aboutHtml from "@/legacy-static/about/index.html?raw";
import contactHtml from "@/legacy-static/contact/index.html?raw";
import coursesHtml from "@/legacy-static/courses/index.html?raw";
import privacyHtml from "@/legacy-static/privacy/index.html?raw";
import servicesHtml from "@/legacy-static/services/index.html?raw";

/* نگاشت فقط مسیرهای عمومی را شامل می‌شود؛ /account و /dashboard پویا هستند. */
export const legacyPages = { home: homeHtml, about: aboutHtml, contact: contactHtml, courses: coursesHtml, privacy: privacyHtml, services: servicesHtml } as const;

/* هدرهای محدودکننده برای HTML عمومی بدون ذخیره داده کاربر اعمال می‌شوند. */
export function legacyHtmlResponse(html: string): Response {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self';",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}
