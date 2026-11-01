import type { ReactNode } from 'react';

export type Crumb = { label: string; href?: string };

// Breadcrumb on the left, page actions on the right (the Frappe-style top bar).
export function PageHeader({ crumbs, actions }: { crumbs: Crumb[]; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-4 py-3 md:px-7">
      <p className="m-0 min-w-0 flex-[1_1_280px] truncate text-base text-neutral-500">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <span key={`${crumb.label}-${index}`}>
              {index > 0 && <span aria-hidden> / </span>}
              {crumb.href && !last
                ? <a href={crumb.href} className="text-neutral-500 no-underline hover:text-neutral-900">{crumb.label}</a>
                : <span className={last ? 'font-medium text-neutral-900' : undefined}>{crumb.label}</span>}
            </span>
          );
        })}
      </p>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}
