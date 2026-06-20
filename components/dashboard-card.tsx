import type { ReactNode } from "react";

export function DashboardCard({
  title,
  value,
  detail,
  icon
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex h-full min-h-[116px] flex-col justify-between gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-coal/70">{title}</p>
          <div className="grid size-9 place-items-center rounded-md border border-line bg-cloud text-slate">{icon}</div>
        </div>
        <div>
          <p className="text-2xl font-semibold tracking-normal text-ink">{value}</p>
          <p className="mt-1 text-sm leading-5 text-coal/68">{detail}</p>
        </div>
      </div>
    </section>
  );
}
