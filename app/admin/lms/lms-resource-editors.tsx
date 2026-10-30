"use client";

import { FormEvent, useId, useState } from "react";

type UpdateHandler = (path: string, action: string, body: unknown, confirmation: string, success: string) => void;

type TitleEditorProps = {
  action: "admin-lms-course-update" | "admin-lms-class-update";
  label: "عنوان دوره" | "عنوان کلاس";
  path: string;
  pending: boolean;
  resourceLabel: string;
  resourceVersion: number;
  title: string;
  onUpdate: UpdateHandler;
};

export function LmsTitleEditor({ action, label, path, pending, resourceLabel, resourceVersion, title, onUpdate }: TitleEditorProps) {
  const inputId = useId();
  const helpId = useId();
  const [value, setValue] = useState(title);
  const normalized = value.trim();
  const unchanged = normalized === title;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || unchanged || normalized.length < 2 || normalized.length > 120) return;
    onUpdate(
      path,
      action,
      { title: normalized, expectedVersion: resourceVersion },
      `تغییر ${label} پس از در دسترس بودن این منبع، در نماهای مرتبط کاربران بزرگسال قابل‌مشاهده خواهد بود. ذخیره شود؟`,
      `${label} به‌روزرسانی شد.`,
    );
  }

  return <form className="account-form" aria-label={`اصلاح ${label} ${resourceLabel}`} onSubmit={submit}>
    <label className="field-row" htmlFor={inputId}>
      <span>اصلاح {label}</span>
      <input id={inputId} value={value} onChange={(event) => setValue(event.target.value)} minLength={2} maxLength={120} aria-describedby={helpId} required />
    </label>
    <small id={helpId}>ثبت با نسخه {resourceVersion} انجام می‌شود. اطلاعات شخصی را در عنوان وارد نکنید.</small>
    <button className="portal-button portal-button--secondary" type="submit" disabled={pending || unchanged}>ذخیره عنوان</button>
  </form>;
}

type LessonPositionEditorProps = {
  lessonId: string;
  pending: boolean;
  position: number;
  resourceLabel: string;
  resourceVersion: number;
  onUpdate: UpdateHandler;
};

export function LessonPositionEditor({ lessonId, pending, position, resourceLabel, resourceVersion, onUpdate }: LessonPositionEditorProps) {
  const inputId = useId();
  const helpId = useId();
  const [value, setValue] = useState(String(position));
  const nextPosition = /^\d{1,4}$/u.test(value) ? Number(value) : Number.NaN;
  const valid = Number.isInteger(nextPosition) && nextPosition >= 1 && nextPosition <= 5_000;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !valid || nextPosition === position) return;
    onUpdate(
      `/api/admin/lms/lessons/${lessonId}`,
      "admin-lms-lesson-update",
      { position: nextPosition, expectedVersion: resourceVersion },
      `جایگاه درس به ${nextPosition} تغییر کند؟ مقصد باید در همین دوره خالی باشد.`,
      "جایگاه درس به‌روزرسانی شد.",
    );
  }

  return <form className="account-form" aria-label={`اصلاح جایگاه درس ${resourceLabel}`} onSubmit={submit}>
    <label className="field-row" htmlFor={inputId}>
      <span>اصلاح جایگاه درس</span>
      <input id={inputId} type="number" min={1} max={5_000} step={1} value={value} onChange={(event) => setValue(event.currentTarget.value)} aria-describedby={helpId} required />
    </label>
    <small id={helpId}>ثبت با نسخه {resourceVersion} انجام می‌شود؛ عنوان و متن درس فقط از صفحه revision تغییر می‌کنند.</small>
    <button className="portal-button portal-button--secondary" type="submit" disabled={pending || !valid || nextPosition === position}>ذخیره جایگاه</button>
  </form>;
}
