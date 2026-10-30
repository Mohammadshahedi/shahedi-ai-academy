/** محدودکننده نرخ D1 برای عملیات تغییردهنده حساب؛ شناسه خام کاربر ذخیره نمی‌شود. */
import { env } from "cloudflare:workers";
export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/* digest ثابت فقط برای گروه‌بندی درخواست‌هاست و credential محسوب نمی‌شود. */
async function digestSubject(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/* پنجره ثابت با upsert اتمیک D1 جلوی مسابقه افزایش شمارنده را می‌گیرد. */
export async function consumeRateLimit(actionCode: string, subject: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  const nowMs = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStartedAt = Math.floor(nowMs / windowMs) * windowMs;
  const subjectDigest = await digestSubject(`${actionCode}:${subject}`);
  const updatedAt = new Date(nowMs).toISOString();
  const row = await env.DB.prepare(`
    INSERT INTO rate_limit_buckets (action_code, subject_digest, window_started_at, request_count, updated_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(action_code, subject_digest, window_started_at)
    DO UPDATE SET request_count = request_count + 1, updated_at = excluded.updated_at
    RETURNING request_count
  `).bind(actionCode, subjectDigest, windowStartedAt, updatedAt).first<{ request_count: number }>();
  const requestCount = row?.request_count ?? limit + 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStartedAt + windowMs - nowMs) / 1000));
  return { allowed: requestCount <= limit, retryAfterSeconds };
}
