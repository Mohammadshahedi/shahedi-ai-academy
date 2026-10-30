/** اطلاعیه حریم خصوصی را از نسخه کنترل‌شده پروژه ارائه می‌کند. */
import { legacyHtmlResponse, legacyPages } from "@/lib/legacy-pages";
export async function GET() { return legacyHtmlResponse(legacyPages.privacy); }
