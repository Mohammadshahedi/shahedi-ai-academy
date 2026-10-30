import type { Metadata } from "next";
import "./globals.css";

/* متادیتای پایه فقط برای صفحات پویا است؛ صفحات معرفی متادیتای مستقل خود را حفظ می‌کنند. */
export const metadata: Metadata = {
  title: "حساب کاربری | آکادمی شاهدی",
  description: "حساب امن و نقش‌محور آکادمی شاهدی برای دانشجوی بزرگسال و والد یا سرپرست.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
