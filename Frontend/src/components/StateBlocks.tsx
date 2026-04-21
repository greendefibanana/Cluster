import type { ReactNode } from "react";

export function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-20 rounded-xl bg-surface-container-low animate-pulse border border-outline-variant/10"
        />
      ))}
    </div>
  );
}

export function InlineError({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-error/20 bg-error/5 p-4 text-left">
      <div className="flex items-center gap-2 text-error">
        <span className="material-symbols-outlined text-base" aria-hidden="true">
          warning
        </span>
        <p className="font-headline text-sm font-semibold">{title}</p>
      </div>
      <p className="mt-2 font-body text-sm text-on-surface-variant">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-outline-variant/15 bg-surface-container-low p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-high">
        <span className="material-symbols-outlined text-primary" aria-hidden="true">
          inbox
        </span>
      </div>
      <div className="space-y-1">
        <p className="font-headline text-base font-semibold text-on-surface">{title}</p>
        <p className="font-body text-sm text-on-surface-variant">{message}</p>
      </div>
      {action}
    </div>
  );
}
