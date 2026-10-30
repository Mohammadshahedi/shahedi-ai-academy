/** تصمیم‌های سیاستی قابل‌جست‌وجو که قبل از انتشار باید بازبینی حقوقی شوند. */
export const ACCOUNT_PRIVACY_NOTICE_VERSION = "phase3b-internal-beta-2026-10";
/* داده کودک تا تصویب رسمی سیاست رضایت و اثبات سرپرستی دریافت نمی‌شود. */
export const MINOR_DATA_COLLECTION_ENABLED = false;
/* نقش‌های عمومی فقط به بزرگسالان تعلق می‌گیرند؛ نقش کارکنان دعوت‌محور باقی می‌ماند. */
export const SELF_SERVICE_ROLES = ["ADULT_STUDENT", "GUARDIAN"] as const;
export type SelfServiceRole = (typeof SELF_SERVICE_ROLES)[number];
/* همه نقش‌های اجرایی برای تایپ‌گذاری و کنترل deny-by-default. */
export const ACCOUNT_ROLES = ["ADULT_STUDENT", "GUARDIAN", "INSTRUCTOR", "ADMIN"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];
/* نقش کارکنان فقط از دعوت معتبر یا bootstrap محدود مدیریت صادر می‌شود. */
export const STAFF_ROLES = ["INSTRUCTOR", "ADMIN"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
/* عملیات مدیریتی فقط با یکی از این permissionهای بسته مجاز هستند. */
export const ACCOUNT_PERMISSIONS = [
  "accounts.read",
  "accounts.status.manage",
  "accounts.roles.manage",
  "staff_invitations.manage",
  "retention.manage",
  "guardian_links.review",
  "courses.manage",
  "classes.manage",
  "classes.assign_instructor",
  "enrollments.manage",
] as const;
export type AccountPermission = (typeof ACCOUNT_PERMISSIONS)[number];
/* مدیر نخستین همه مجوزهای مدیریتی فاز ۳B.2 را صریح و قابل‌لغو دریافت می‌کند. */
export const BOOTSTRAP_ADMIN_PERMISSIONS: readonly AccountPermission[] = ACCOUNT_PERMISSIONS;
/* پاک‌سازی نهایی تا وجود نسخه مصوب نگهداری داده غیرفعال می‌ماند. */
export const ACCOUNT_PURGE_ENABLED = false;

/*
 * وضعیت‌های آمادگی ۳B.۳ فقط قرارداد read-only هستند؛ وجود آن‌ها هیچ feature gate یا
 * جمع‌آوری داده‌ای را فعال نمی‌کند و تصمیم حقوقی را به‌جای مدیر ثبت نمی‌کند.
 */
export const MINOR_READINESS_STATUS = "BLOCKED" as const;
export const MINOR_READINESS_ITEMS = [
  { code: "MANAGED_IDENTITY", title: "هویت مدیریت‌شده Sites", state: "READY", detail: "حساب سرپرست از هویت مدیریت‌شده و شناسه پایدار همین Site استفاده می‌کند." },
  { code: "DATA_RESIDENCY", title: "اقامت و محل پردازش داده", state: "BLOCKED", detail: "سازگاری D1 با الزامات حقوقی محل فعالیت آکادمی هنوز تأیید نشده است." },
  { code: "RETENTION_POLICY", title: "نگهداری، حذف و بازیابی", state: "BLOCKED", detail: "مدت نگهداری پرونده، رضایت و audit و فرایند حذف پس از لغو رضایت تصویب نشده است." },
  { code: "GUARDIAN_VERIFICATION", title: "اثبات سرپرستی", state: "BLOCKED", detail: "روش کم‌داده اثبات سرپرستی و مسئول بررسی آن هنوز انتخاب نشده است." },
  { code: "CONSENT_NOTICE", title: "متن رضایت نسخه‌دار", state: "BLOCKED", detail: "متن رضایت و اطلاعیه حریم خصوصی زیر ۱۸ سال بازبینی حقوقی نشده است." },
  { code: "DISPUTE_WORKFLOW", title: "اختلاف یا تغییر سرپرست", state: "BLOCKED", detail: "فرایند رد، تعلیق، اختلاف دو سرپرست و انتقال سرپرستی تصویب نشده است." },
  { code: "INCIDENT_OWNER", title: "پاسخ‌گو و بازبینی دوره‌ای", state: "BLOCKED", detail: "مالک پاسخ رخداد، بازیابی و بازبینی دوره‌ای پیوندها تعیین نشده است." },
] as const;
