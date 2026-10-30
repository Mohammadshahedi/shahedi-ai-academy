/* Vite فایل‌های HTML تثبیت‌شده را هنگام build به رشته منبع تبدیل می‌کند. */
declare module "*.html?raw" {
  const content: string;
  export default content;
}
