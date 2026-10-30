/** صفحه اصلی تثبیت‌شده را از پوسته Worker جدید ارائه می‌کند. */
import { legacyHtmlResponse, legacyPages } from "@/lib/legacy-pages";
export async function GET() { return legacyHtmlResponse(legacyPages.home); }
