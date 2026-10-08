/* رفتارهای مشترک صفحات داخلی آکادمی شاهدی — فاز ۲ */

/* منوی موبایل را باز و بسته می‌کند و وضعیت دسترس‌پذیری را همگام نگه می‌دارد. */
const menuButton = document.querySelector(".menu-button");
const mainMenu = document.querySelector("#main-menu");
if (menuButton && mainMenu) {
  /* منو را می‌بندد و متن کنترلی دکمه را بازنشانی می‌کند. */
  const closeMenu = () => {
    mainMenu.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "باز کردن منو");
  };
  menuButton.addEventListener("click", () => {
    const isOpen = mainMenu.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "بستن منو" : "باز کردن منو");
  });
  /* پس از انتخاب لینک، منوی موبایل بسته می‌شود. */
  mainMenu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    closeMenu();
  }));
  /* Escape و کلیک بیرون، راه‌های استاندارد خروج از منوی باز هستند. */
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mainMenu.classList.contains("is-open")) {
      closeMenu();
      menuButton.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (!mainMenu.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
  });
}

/* سال جاری را با ارقام فارسی در پابرگ قرار می‌دهد. */
const yearTarget = document.querySelector("#year");
if (yearTarget) yearTarget.textContent = new Intl.DateTimeFormat("fa-IR", { year: "numeric" }).format(new Date());

/* کارت‌های دوره را براساس سطح یا نوع هدف فیلتر می‌کند. */
const filterButtons = document.querySelectorAll("[data-course-filter]");
const courseCards = document.querySelectorAll("[data-course-categories]");
const courseCount = document.querySelector("#course-count");
if (filterButtons.length && courseCards.length) {
  filterButtons.forEach((button) => button.addEventListener("click", () => {
    const selectedFilter = button.dataset.courseFilter;
    let visibleCount = 0;
    filterButtons.forEach((item) => item.setAttribute("aria-pressed", "false"));
    button.setAttribute("aria-pressed", "true");
    courseCards.forEach((card) => {
      const categories = card.dataset.courseCategories.split(" ");
      const shouldShow = selectedFilter === "all" || categories.includes(selectedFilter);
      card.hidden = !shouldShow;
      if (shouldShow) visibleCount += 1;
    });
    /* تعداد نتیجه‌ها برای کاربران صفحه‌خوان نیز اعلام می‌شود. */
    if (courseCount) courseCount.textContent = `${visibleCount.toLocaleString("fa-IR")} مسیر آموزشی نمایش داده می‌شود.`;
  }));
}

/* ابزار تماس form نیست و فقط متن محلی می‌سازد؛ بنابراین بدون JS نیز داده‌ای ارسال نمی‌شود. */
const consultationBuilder = document.querySelector("#consultation-builder");
const generateRequestButton = document.querySelector("#generate-request");
const builderStatus = document.querySelector("#builder-status");
const requestOutput = document.querySelector("#request-output");
const requestText = document.querySelector("#request-text");
const copyButton = document.querySelector("#copy-request");
const copyStatus = document.querySelector("#copy-status");
if (consultationBuilder && generateRequestButton && requestOutput && requestText) {
  generateRequestButton.addEventListener("click", () => {
    /* مقدار هر فیلد فقط از همین ابزار و بدون تفسیر HTML خوانده می‌شود. */
    const valueOf = (name) => String(consultationBuilder.querySelector(`[name="${name}"]`)?.value || "").trim();
    const name = valueOf("name") || "ذکر نشده";
    const applicant = valueOf("applicant") || "ذکر نشده";
    const city = valueOf("city") || "ذکر نشده";
    const level = valueOf("level") || "ذکر نشده";
    const goal = valueOf("goal");
    if (!goal) {
      if (builderStatus) builderStatus.textContent = "لطفاً هدف یا نیاز خود را کوتاه بنویسید.";
      consultationBuilder.querySelector('[name="goal"]')?.focus();
      return;
    }
    requestText.textContent = ["سلام، برای مشاوره آکادمی شاهدی پیام می‌دهم.", `نام: ${name}`, `نوع متقاضی: ${applicant}`, `شهر: ${city}`, `سطح فعلی: ${level}`, `هدف یا نیاز: ${goal}`, "لطفاً درباره مسیر مناسب راهنمایی بفرمایید."].join("\n");
    requestOutput.hidden = false;
    if (copyStatus) copyStatus.textContent = "متن آماده شد؛ آن را کپی و در تلگرام ارسال کنید.";
    if (builderStatus) builderStatus.textContent = "";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestOutput.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  });
}

/* متن ساخته‌شده را با راهکار جایگزین برای مرورگرهای قدیمی کپی می‌کند. */
if (copyButton && requestText) {
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(requestText.textContent);
      if (copyStatus) copyStatus.textContent = "متن با موفقیت کپی شد.";
    } catch (error) {
      const range = document.createRange();
      range.selectNodeContents(requestText);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      if (copyStatus) copyStatus.textContent = "متن انتخاب شد؛ گزینه Copy را بزنید.";
    }
  });
}
