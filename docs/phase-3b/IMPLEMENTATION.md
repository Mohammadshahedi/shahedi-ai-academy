# راهنمای اجرای فازهای ۳B.1، ۳B.2 و ۳B.۳–آماده‌سازی

## نتیجه فعلی

حساب واقعی بزرگسال، مدیریت حساب و دعوت کارکنان روی Vinext Worker و D1 پیاده‌سازی شده‌اند. هویت و نشست توسط ChatGPT Sites مدیریت می‌شود و آکادمی رمز عبور، OTP یا توکن بازیابی ذخیره نمی‌کند.

برش ۳B.۳–آماده‌سازی فقط وضعیت تصمیم‌های لازم را در `/admin/minor-readiness/` به مدیر مجاز نشان می‌دهد. این صفحه read-only است و هیچ تصمیم حقوقی، رضایت، مدرک یا داده کودک ثبت نمی‌کند.

## جریان‌های فعال در کد

1. کاربر از مسیر `/signin-with-chatgpt` وارد می‌شود.
2. سرور شناسه پایدار Site را از header معتبر دریافت می‌کند.
3. کاربر بزرگسال یکی از نقش‌های `ADULT_STUDENT` یا `GUARDIAN` را انتخاب می‌کند.
4. حساب، هویت مرجع، نقش و audit موفق در یک batch D1 نوشته می‌شوند.
5. داشبورد نقش‌ها را در هر درخواست از سرور دوباره می‌خواند.
6. خروج از مسیر مدیریت‌شده `/signout-with-chatgpt` انجام می‌شود.
7. مدیر نخست با secret یک‌بارمصرف runtime و بدون hard-code شناسه bootstrap می‌شود.
8. دعوت کارکنان token خام را فقط یک‌بار نشان می‌دهد و پذیرش با ایمیل تأییدشده Sites انجام می‌شود.
9. تعلیق، نقش و permission در هر mutation دوباره از D1 بررسی و audit می‌شوند.
10. درخواست حذف ثبت می‌شود، ولی purge تا تصویب نسخه نگهداری داده غیرفعال است.
11. حساب فعال دارای نقش `ADMIN` و `guardian_links.review` وضعیت readiness را می‌بیند، بدون اینکه feature gate تغییر کند.

## مرزهای عمداً بسته

- endpoint کودک payload را نمی‌خواند و تا زمان تصویب سیاست با `423` رد می‌کند.
- نقش `INSTRUCTOR` یا `ADMIN` از onboarding عمومی صادر نمی‌شود.
- ارسال خودکار ایمیل دعوت provider ندارد و token از کانال امن مدیریت تحویل می‌شود.
- جدول سیاست نگهداری خالی است و حذف نهایی حساب اجرا نمی‌شود.
- دوره، کلاس، تمرین، آزمون، پرداخت و گزارش پیشرفت خارج از دامنه این برش هستند.
- آمادگی ۳B.۳ به معنی تأیید حقوقی یا اجازه دریافت داده زیر ۱۸ سال نیست.

## اجرای کنترل‌ها

```bash
npm ci
npm run check
npm run db:generate
npm run build
```

پس از build، migrationهای محلی به‌ترتیب اعمال می‌شوند:

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_puzzling_calypso.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_old_phil_sheldon.sql
```

در اجرای ثبت‌شده ۲۱ مهر ۱۴۰۵، ۲۱ دستور migration با موفقیت اعمال شدند و build همه مسیرهای عمومی، حساب، داشبورد و API را تولید کرد.

پس از انتشار advisoryهای جدید، Next.js به `16.4.3`، Zod به `4.6.7` و Sharp به `0.35.5` ارتقا یافتند و `fast-uri` نیز به نسخه اصلاح‌شده رسید. build مجدد موفق بود و `npm audit --omit=dev` هیچ آسیب‌پذیری runtime گزارش نکرد. هشدارهای باقی‌مانده audit کامل مربوط به ابزارهای توسعه پین‌شده starter هستند و باید هنگام ارتقای مستقل Vinext/Vite/Cloudflare بازبینی شوند.

## دروازه قبل از انتشار خصوصی

1. بازبینی نهایی diff، اسرار و فایل‌های generated.
2. تنظیم secret حداقل ۳۲ نویسه‌ای bootstrap در runtime، استفاده یک‌بار و حذف آن پس از موفقیت.
3. بازبینی حقوقی اطلاعیه `phase3b-internal-beta-2026-10`.
4. آزمون runtime هویت، D1، دعوت و مرزهای نقش در Site خصوصی.
5. حفظ audience خصوصی فعلی؛ عمومی‌کردن نیازمند دستور جداگانه است.

## مرحله بعدی پیشنهادی پس از readiness

فاز ۳B.3 فقط پس از تأیید حقوقی، مسیر اثبات سرپرستی، رضایت نسخه‌دار و پرونده حداقلی کودک را باز می‌کند. تا آن زمان endpoint کودک باید بدون خواندن payload پاسخ `423` بدهد.
