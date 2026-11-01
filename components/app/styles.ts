// Shared class names for the Frappe-style controls: black primary actions,
// grey secondary ones, grey filled inputs.

const base = 'inline-flex shrink-0 items-center justify-center gap-2 rounded-[9px] text-sm font-medium no-underline transition-colors disabled:pointer-events-none disabled:opacity-40';

export const button = {
  primary: `${base} min-h-9 bg-neutral-900 px-3.5 text-surface hover:bg-neutral-800`,
  secondary: `${base} min-h-9 bg-neutral-100 px-3.5 text-neutral-900 hover:bg-neutral-200`,
  ghost: `${base} min-h-9 px-2.5 text-neutral-700 hover:bg-neutral-100`,
  danger: `${base} min-h-9 bg-danger-soft px-3.5 text-danger hover:bg-danger-soft-hover`,
  icon: `${base} size-11 text-neutral-700 hover:bg-hover`,
};

export const input = 'w-full rounded-[9px] border border-transparent bg-neutral-100 px-3 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-500 focus:border-neutral-300 focus:bg-surface';

export const card = 'rounded-[14px] border border-neutral-200 bg-surface';

export const segmented = {
  group: 'inline-flex w-fit gap-0.5 rounded-[9px] bg-neutral-100 p-[3px]',
  item: (active: boolean) => `rounded-[7px] px-3 py-1.5 text-[13px] ${active ? 'bg-surface font-medium text-neutral-900 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'}`,
};
