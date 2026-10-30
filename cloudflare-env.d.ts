declare namespace Cloudflare {
  interface Env {
    /* پایگاه داده اصلی حساب‌ها و نقش‌ها در فاز ۳B. */
    DB?: D1Database;
    /* این فاز فایل کاربر ذخیره نمی‌کند؛ binding برای سازگاری starter اختیاری است. */
    BUCKET?: R2Bucket;
    /* راز یک‌بارمصرف bootstrap مدیر نخستین فقط در تنظیمات میزبانی نگهداری می‌شود. */
    ACADEMY_BOOTSTRAP_SECRET?: string;
  }
}
