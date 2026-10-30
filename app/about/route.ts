/** صفحه عمومی درباره آکادمی را بدون تغییر محتوایی ارائه می‌کند. */
import { legacyHtmlResponse, legacyPages } from "@/lib/legacy-pages";
export async function GET() { return legacyHtmlResponse(legacyPages.about); }
