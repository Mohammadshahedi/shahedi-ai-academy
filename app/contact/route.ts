/** صفحه تماس و سازنده محلی پیام را از منبع تثبیت‌شده ارائه می‌کند. */
import { legacyHtmlResponse, legacyPages } from "@/lib/legacy-pages";
export async function GET() { return legacyHtmlResponse(legacyPages.contact); }
