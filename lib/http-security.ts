/** کنترل‌های مشترک پاسخ API، CSRF و شناسه درخواست در مرز سرور. */
export type MutationCheck = { ok: true } | { ok: false; response: Response };
export type JsonBodyResult = { ok: true; value: unknown } | { ok: false; response: Response };

/* پاسخ JSON حساب‌ها هرگز در کش مرورگر یا واسط نگه داشته نمی‌شود. */
export function privateJson(payload: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Pragma", "no-cache");
  headers.set("X-Content-Type-Options", "nosniff");
  return Response.json(payload, { ...init, headers });
}

/* عملیات تغییردهنده فقط JSON هم‌مبدأ با هدر اختصاصی رابط پذیرفته می‌شود. */
export function validateTrustedMutation(request: Request, expectedAction: string): MutationCheck {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const contentType = request.headers.get("content-type") ?? "";
  const action = request.headers.get("x-shahedi-action");
  if (origin !== requestUrl.origin || (fetchSite && fetchSite !== "same-origin")) return { ok: false, response: privateJson({ code: "UNTRUSTED_ORIGIN" }, { status: 403 }) };
  if (!contentType.toLowerCase().startsWith("application/json")) return { ok: false, response: privateJson({ code: "JSON_REQUIRED" }, { status: 415 }) };
  if (action !== expectedAction) return { ok: false, response: privateJson({ code: "ACTION_HEADER_REQUIRED" }, { status: 403 }) };
  return { ok: true };
}

/* شناسه تصادفی امکان اتصال رخدادهای فنی را بدون ذخیره payload فراهم می‌کند. */
export function createRequestId(): string { return crypto.randomUUID(); }

/* بدنه JSON پیش از parse به ۴ کیلوبایت محدود می‌شود تا ورودی کوچک حساب حافظه را مصرف نکند. */
export async function readLimitedJson(request: Request, requestId: string, maxBytes = 4096): Promise<JsonBodyResult> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > maxBytes) return { ok: false, response: privateJson({ code: "REQUEST_BODY_TOO_LARGE", requestId }, { status: 413 }) };
  if (!request.body) return { ok: false, response: privateJson({ code: "INVALID_BODY", requestId }, { status: 400 }) };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel("request body limit exceeded");
        return { ok: false, response: privateJson({ code: "REQUEST_BODY_TOO_LARGE", requestId }, { status: 413 }) };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, response: privateJson({ code: "INVALID_BODY", requestId }, { status: 400 }) };
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) }; } catch { return { ok: false, response: privateJson({ code: "INVALID_JSON", requestId }, { status: 400 }) }; }
}
