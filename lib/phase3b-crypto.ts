/** ابزارهای رمزنگاری کوچک فاز ۳B.2؛ هیچ secret یا token خامی در پایگاه داده ذخیره نمی‌شود. */

/* ایمیل تأییدشده پلتفرم برای مقایسه دعوت، به شکل پایدار و بدون فاصله نرمال می‌شود. */
export function normalizeVerifiedEmail(email: string): string {
  return email.trim().normalize("NFKC").toLowerCase();
}

/* خروجی SHA-256 به hex تبدیل می‌شود تا در D1 و مقایسه‌های ثابت قابل‌استفاده باشد. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/* توکن دعوت با ۲۵۶ بیت تصادف تولید و فقط یک‌بار در پاسخ خصوصی مدیر نمایش داده می‌شود. */
export function createOpaqueToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

/* binding ایمیل با token پرآنتروپی، حدس آفلاین ایمیل از digest ذخیره‌شده را بی‌اثر می‌کند. */
export async function invitationDigests(token: string, email: string): Promise<{ tokenDigest: string; emailBindingDigest: string }> {
  const normalizedEmail = normalizeVerifiedEmail(email);
  const [tokenDigest, emailBindingDigest] = await Promise.all([
    sha256Hex(token),
    sha256Hex(`${token}:${normalizedEmail}`),
  ]);
  return { tokenDigest, emailBindingDigest };
}

/* راز bootstrap با مقایسه digestهای هم‌طول بررسی می‌شود تا مقایسه مستقیم رشته‌ای حذف شود. */
export async function secureSecretMatches(provided: string, expected: string): Promise<boolean> {
  const [providedDigest, expectedDigest] = await Promise.all([sha256Hex(provided), sha256Hex(expected)]);
  let difference = 0;
  for (let index = 0; index < expectedDigest.length; index += 1) {
    difference |= providedDigest.charCodeAt(index) ^ expectedDigest.charCodeAt(index);
  }
  return difference === 0;
}
