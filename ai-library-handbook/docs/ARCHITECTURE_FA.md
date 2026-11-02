# معماری جزوه کتابخانه هوش مصنوعی

این پروژه یک پلتفرم آموزشی ماژولار برای ۲۱ کتابخانه و ابزار هوش مصنوعی است. هر کتاب شش مرحله، یک پروژه پایانی، آزمایشگاه کد، تمرین، Quiz، Mistake Lab و گزارش تسلط دارد.

## لایه‌ها

1. محتوا و تجربه یادگیری در `static/index.html`
2. اجرای Python مرورگری با Pyodide و Web Worker
3. Notebook Lab برای GPU، شبکه، دوربین و مدل‌های سنگین
4. حساب، Sync و نقش‌ها با FastAPI و SQLite
5. Docker، Caddy، Backup، Restore، Monitoring و Rollback
6. Pytest، Release Gate و Content Audit

## قرارداد ماژول

هر کلید در `ACTIVE_MODULES` باید قفسه، تعریف ماژول، دقیقاً شش مرحله و APIهای ارزیابی متناظر داشته باشد. مرحله ششم Capstone همان کتاب است.
