"use client";

import { FormEvent, useState } from "react";
import type { LessonRevision, LmsLesson } from "@/lib/phase3c-lms";

type RevisionData = { lesson: LmsLesson; revisions: LessonRevision[]; nextOffset: number | null };

export function LessonRevisionConsole({ data, offset }: { data: RevisionData; offset: number }) {
  const [title, setTitle] = useState(data.lesson.title);
  const [body, setBody] = useState(data.lesson.bodyText);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  async function send(path: string, action: string, payload: unknown, confirmation?: string) {
    if (pending || (confirmation && !window.confirm(confirmation))) return;
    setPending(true); setHasError(false); setMessage("در حال ثبت تغییر…");
    try {
      const response = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Shahedi-Action": action },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({})) as { code?: string };
      if (!response.ok) throw new Error(result.code ?? "REQUEST_DENIED");
      window.location.reload();
    } catch (error) {
      const code = error instanceof Error ? error.message : "REQUEST_DENIED";
      setHasError(true);
      setMessage(code === "VERSION_CONFLICT" ? "نسخه درس تغییر کرده است؛ صفحه را تازه کنید و دوباره تصمیم بگیرید." : "عملیات رد شد؛ permission، مالکیت revision یا وضعیت درس را بررسی کنید.");
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(`/api/admin/lms/lessons/${data.lesson.lessonId}/revisions`, "admin-lms-lesson-revision-create", { title, bodyText: body });
  }

  return <div className="admin-stack">
    <p className={`form-message ${hasError ? "form-message--error" : "form-message--success"}`} role="status" aria-live="polite">{message}</p>
    <section className="portal-card">
      <h2>نسخه منتشرشده</h2>
      <p>{data.lesson.publishedRevisionId ? <bdi dir="ltr">{data.lesson.publishedRevisionId.slice(0, 8)}…</bdi> : <strong>محتوای قدیمی — بدون تاریخچه revision</strong>}</p>
      <p>نسخه درس: {data.lesson.version}</p>
      <p><small>متن revision ممکن است شامل محتوای آموزشی باشد؛ اطلاعات شخصی یا داده حساس را در آن وارد نکنید.</small></p>
    </section>
    <section className="portal-card">
      <h2>ساخت revision</h2>
      <form className="account-form" onSubmit={submit}>
        <label className="field-row"><span>عنوان</span><input value={title} onChange={(event) => setTitle(event.target.value)} minLength={2} maxLength={120} required /></label>
        <label className="field-row"><span>متن ساده</span><textarea value={body} onChange={(event) => setBody(event.target.value)} minLength={1} maxLength={20_000} required rows={10} /></label>
        <button className="portal-button" disabled={pending}>ساخت نسخه تغییرناپذیر</button>
      </form>
    </section>
    <section className="admin-stack" aria-label="تاریخچه نسخه‌های محتوای درس">
      <h2>تاریخچه نسخه‌ها</h2>
      {data.revisions.length ? data.revisions.map((revision) => {
        const isCurrent = revision.revisionId === data.lesson.publishedRevisionId;
        const reasonCode = revision.lastPublishedAt ? "CONTENT_ROLLBACK" : "CONTENT_UPDATE";
        const actionLabel = revision.lastPublishedAt ? "بازگردانی این نسخه" : "انتشار این نسخه";
        return <article className="portal-card" key={revision.revisionId}>
          <div className="admin-account__header"><div><h3>{revision.title}</h3><small>شناسه <bdi dir="ltr">{revision.revisionId.slice(0, 8)}…</bdi><br />ساخته‌شده در <time dateTime={revision.createdAt}>{revision.createdAt}</time> — عامل داخلی <bdi dir="ltr">{revision.createdByAccountId.slice(0, 8)}…</bdi></small></div>{isCurrent ? <span className="status-chip">منتشرشده</span> : null}</div>
          <pre className="lesson-body">{revision.bodyText}</pre>
          {revision.lastPublishedAt ? <p><small>آخرین انتشار: <time dateTime={revision.lastPublishedAt}>{revision.lastPublishedAt}</time></small></p> : <p><small>این revision هنوز منتشر نشده است.</small></p>}
          <div className="action-row"><button className="portal-button" disabled={pending || isCurrent} onClick={() => void send(`/api/admin/lms/lessons/${data.lesson.lessonId}/revisions/${revision.revisionId}/publish`, "admin-lms-lesson-revision-publish", { expectedLessonVersion: data.lesson.version, reasonCode }, `${actionLabel}؟ محتوای قابل‌مشاهده دانشجو فقط پس از تأیید شما تغییر می‌کند.`)}>{actionLabel}</button></div>
        </article>;
      }) : <article className="portal-card"><p>هنوز revisionی ساخته نشده است.</p></article>}
      <nav className="pagination" aria-label="صفحه‌بندی revisionها">
        {offset > 0 ? <a className="portal-button portal-button--secondary" href={`?offset=${Math.max(0, offset - 25)}`}>صفحه قبل</a> : null}
        {data.nextOffset !== null ? <a className="portal-button portal-button--secondary" href={`?offset=${data.nextOffset}`}>صفحه بعد</a> : null}
      </nav>
    </section>
  </div>;
}
