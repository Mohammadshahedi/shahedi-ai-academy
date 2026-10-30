/** صفحه مسیرهای آموزشی تثبیت‌شده را ارائه می‌کند. */
import { legacyHtmlResponse, legacyPages } from "@/lib/legacy-pages";
export async function GET() { return legacyHtmlResponse(legacyPages.courses); }
