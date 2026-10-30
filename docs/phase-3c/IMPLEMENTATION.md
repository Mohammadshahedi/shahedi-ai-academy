# اجرای فاز ۳C — LMS فقط بزرگسالان

## فاز ۳C.۴ — اصلاح امن فراداده در پنل

این فاز migration، schema یا API تازه ندارد. سه `PATCH` موجود برای اصلاح عنوان دوره، عنوان کلاس و جایگاه درس اکنون از `/admin/lms/` در دسترس‌اند. هر فرم مقدار و `expectedVersion` همان صفحه را می‌فرستد؛ `VERSION_CONFLICT` بدون retry خودکار به تازه‌سازی و بازبینی دوباره نیاز دارد و `LESSON_POSITION_CONFLICT` یعنی جایگاه مقصد در همان دوره اشغال است.

فرم‌ها فقط با permission صریح متناظر و برای منبع غیرنهایی نمایش داده می‌شوند؛ سرور نیز حساب فعال، نقش فعال `ADMIN` و permission تازه را دوباره کنترل می‌کند. اصلاح موفق `version` را افزایش می‌دهد و mutation+audit را اتمیک ثبت می‌کند، اما lifecycle event نمی‌سازد. عنوان و متن درس در این مسیر پذیرفته نمی‌شوند و همچنان فقط از revision فاز ۳C.۳ تغییر می‌کنند.

## فاز ۳C.۳ — revision امن درس

`0004_typical_rick_jones.sql` revision/publication append-only و pointer nullable را اضافه می‌کند؛ backfill و revision مصنوعی ممنوع است. انتشار با ownership، permission، منبع non-archived و `expectedLessonVersion`، pointer و base را به‌روزرسانی و publication+audit را اتمیک ثبت می‌کند. PATCH قبلی فقط position است. دانشجو برای pointer غیرتهی مستقیماً revision را می‌خواند و فقط برای محتوای legacy با pointer تهی از base استفاده می‌کند.

APIهای `POST/GET .../lessons/[lessonId]/revisions` ساخت و فهرست ۲۵تایی را ارائه می‌کنند. `POST .../revisions/[revisionId]/publish` فقط reason بسته `CONTENT_UPDATE/CONTENT_ROLLBACK` می‌پذیرد. صفحه `/admin/lms/lessons/[lessonId]/revisions/` preview امن React، نسخه جاری، عامل داخلی کوتاه و انتشار/بازگردانی صریح را نشان می‌دهد؛ متن revision در audit یا publication metadata کپی نمی‌شود.

## فاز ۳C.۲ — چرخه عمر نسخه‌دار

migration افزایشی `0003_friendly_lady_bullseye.sql` بدون تغییر `0000` تا `0002`، ستون `version DEFAULT 1` و timestampهای nullable چرخه عمر را به دوره، کلاس، درس و enrollment اضافه می‌کند. جدول `lms_lifecycle_events` فقط نوع/شناسه داخلی منبع، وضعیت پیشین/بعدی، دلیل بسته، نسخه، شناسه داخلی actor، request ID و زمان را نگه می‌دارد؛ reason code در سطح دیتابیس بسته است، هر منبع/نسخه unique است و triggerهای migration هر `UPDATE` یا `DELETE` را رد می‌کنند.

ساخت دوره، کلاس و درس همیشه `DRAFT`، ساخت enrollment همیشه `ACTIVE` و تخصیص مدرس همیشه `ASSIGNED` است. PATCHهای محتوایی status را تغییر نمی‌دهند؛ از ۳C.۳ به بعد PATCH درس فقط جایگاه و `expectedVersion` را می‌پذیرد و عنوان/متن از revision عبور می‌کنند. گذارها endpoint مستقل `POST .../transitions` دارند:

- دوره: `DRAFT ↔ ACTIVE` و سپس `ARCHIVED` نهایی؛ آرشیو فقط وقتی همه کلاس‌ها `CLOSED` باشند.
- کلاس: `DRAFT ↔ ACTIVE` و سپس `CLOSED` نهایی؛ بستن فقط بدون enrollment فعال و assignment فعال.
- درس: `DRAFT ↔ PUBLISHED` و سپس `ARCHIVED` نهایی.
- enrollment: `ACTIVE → COMPLETED/WITHDRAWN`؛ بازگشت `COMPLETED` فقط با `ADMIN_CORRECTION` و بازگشت `WITHDRAWN` فقط با `RE_ENROLLMENT/ADMIN_CORRECTION` و eligibility تازه.
- لغو assignment رخداد `ASSIGNED → REVOKED` ثبت می‌کند.

هر تغییر وضعیت، lifecycle event و audit را در یک D1 batch اتمیک ثبت می‌کند. ویرایش محتوا lifecycle event ندارد، اما تغییر و audit آن نیز اتمیک است. اختلاف `expectedVersion` با `409 VERSION_CONFLICT` fail-closed می‌شود. تاریخچه `GET /api/admin/lms/lifecycle` و `/admin/lms/lifecycle/` با permission متناظر هر نوع منبع، صفحه‌بندی ۲۵تایی و بدون عنوان، متن درس، ایمیل یا PII ارائه می‌شود.

این فاز همچنان فقط بزرگسالان است؛ داده کودک، پرداخت، قیمت، ظرفیت، تاریخ، فایل، تکلیف، نمره، analytics و قابلیت تجاری اضافه نشده‌اند.

## دامنه فعال

این برش فقط دوره، درس متنی، کلاس، تخصیص مدرس و ثبت‌نام حساب بزرگسال را پیاده می‌کند. دوره‌ها همیشه `ADULT_ONLY` هستند و هیچ مسیر self-enrollment عمومی وجود ندارد.

مدل D1 با migration افزایشی `0002_daily_banshee.sql` پنج جدول دارد:

- `lms_courses`: عنوان داخلی، audience ثابت و وضعیت `DRAFT/ACTIVE/ARCHIVED`
- `lms_lessons`: عنوان، متن ساده محدود، جایگاه و وضعیت `DRAFT/PUBLISHED/ARCHIVED`
- `lms_classes`: اتصال به دوره و وضعیت `DRAFT/ACTIVE/CLOSED`
- `lms_class_instructor_assignments`: assignment قابل‌لغو مدرس فعال
- `lms_enrollments`: اتصال یکتای کلاس/دانشجوی بزرگسال با وضعیت `ACTIVE/COMPLETED/WITHDRAWN`

هیچ seed، قیمت، ظرفیت، تاریخ، شهر، پرداخت، گواهینامه، فایل، HTML غنی، تمرین، نمره یا analytics اضافه نشده است.

## مجوز و دسترسی

- `courses.manage`: ساخت/ویرایش دوره و درس
- `classes.manage`: ساخت/ویرایش کلاس
- `classes.assign_instructor`: تخصیص و لغو مدرس
- `enrollments.manage`: ثبت‌نام و تغییر وضعیت ثبت‌نام

نقش `ADMIN` میان‌بر نیست. هر mutation حساب فعال، نقش فعال مدیر و permission تازه را داخل query D1 کنترل می‌کند. assignment فقط برای حساب فعال دارای `INSTRUCTOR` و enrollment فقط برای حساب فعال، تأییدشده بزرگسال و دارای `ADULT_STUDENT` انجام می‌شود.

تغییر دامنه و audit موفق در یک D1 batch انجام می‌شوند؛ اگر audit درج نشود، mutation نیز commit نمی‌شود. ثبت‌نام self-target مدیر هم در SQL رد می‌شود و نبود self-enrollment فقط به نبود endpoint عمومی محدود نیست.

دانشجو فقط با enrollment فعال، کلاس فعال و دوره فعال وارد `/learn/classes/[classId]/` می‌شود و فقط درس `PUBLISHED` را می‌بیند. مدرس فقط کلاس دارای assignment فعال خود را در `/teach/` می‌بیند؛ roster، ایمیل و شناسه هویت پلتفرم query نمی‌شوند.

کنسول مدیریت برای دوره‌ها، کلاس‌ها، assignmentها و enrollmentها صفحه‌بندی مستقل ۲۵تایی دارد تا هیچ رکورد فعالی پشت سقف ثابت پنهان نشود. فهرست کلاس‌های دانشجو، کلاس‌های مدرس و درس‌های منتشرشده نیز صفحه‌بندی ۲۵تایی دارند. فهرست پیشنهادی حساب‌ها فقط کمک ورودی است و مدیر می‌تواند UUID داخلی معتبر را مستقیماً وارد کند.

## API مدیریت

- `POST/PATCH /api/admin/lms/courses...`
- `POST/PATCH /api/admin/lms/.../lessons...`
- `POST/PATCH /api/admin/lms/classes...`
- `POST/DELETE /api/admin/lms/classes/.../instructors...`
- `POST/PATCH /api/admin/lms/classes/.../enrollments...`

همه mutationها JSON strict، origin/action header، body limit، rate limit، پاسخ `no-store` و UUID داخلی دارند. audit فقط action، نوع هدف، UUID، نتیجه و status code دامنه را ثبت می‌کند و عنوان یا متن درس را نمی‌نویسد. خواندن کلاس و درس دانشجو نیز در یک query انجام می‌شود تا revoke هم‌زمان بین دو query باعث افشای متن نشود.

## مرزهای بسته

- `MINOR_DATA_COLLECTION_ENABLED = false` و endpoint کودک همچنان `423` پیش از خواندن body است.
- مسیر والد/کودک، پرداخت، ظرفیت، تقویم، فایل، تمرین، آزمون، نمره و گزارش پیشرفت خارج از این فازند.
- محتوای درس text-only است و در React بدون `dangerouslySetInnerHTML` نمایش داده می‌شود.
- اطلاعات قطعی دوره ساخته یا seed نشده‌اند؛ مدیر فقط پس از دریافت اطلاعات رسمی محتوا می‌سازد.

## rollback

اگر migration مرحله جاری هنوز در هیچ محیطی اعمال نشده است، کامیت همان مرحله را می‌توان پیش از انتشار revert کرد. پس از اعمال `0003/0004`، migrationها هرگز حذف یا بازنویسی نمی‌شوند و writer قدیمی نیز نباید دوباره deploy شود، چون optimistic lock، lifecycle history یا revision flow را دور می‌زند. در محیط migrate‌شده فقط mutationهای LMS را متوقف، پنل را موقتاً read-only و یک نسخه اصلاحی سازگار با schema به‌صورت fix-forward منتشر کنید؛ داده و تاریخچه موجود حفظ می‌شوند.
