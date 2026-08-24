import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export const adminLabelClass = "block text-[13px] font-medium text-brand-muted";

/** Shared look for text, number, date, and select controls. */
export const adminControlClass =
  "w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-brand-ink outline-none transition-shadow focus:border-brand-green focus:ring-2 focus:ring-brand-green/40 disabled:cursor-not-allowed disabled:opacity-55";

export const adminFieldClass = `mt-1.5 ${adminControlClass}`;

export const adminTextareaClass = `${adminFieldClass} resize-y`;

type AdminInputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Skip the default top margin when the parent already provides spacing. */
  bare?: boolean;
};

export const AdminInput = forwardRef<HTMLInputElement, AdminInputProps>(function AdminInput(
  { className, bare = false, ...props },
  ref
) {
  return <input ref={ref} className={cx(bare ? adminControlClass : adminFieldClass, className)} {...props} />;
});

type AdminSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  bare?: boolean;
};

export const AdminSelect = forwardRef<HTMLSelectElement, AdminSelectProps>(function AdminSelect(
  { className, bare = false, children, ...props },
  ref
) {
  return (
    <span className={cx("relative block", !bare && "mt-1.5")}>
      <select
        ref={ref}
        className={cx(adminControlClass, "appearance-none !pr-9", className)}
        {...props}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
});

export const AdminTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function AdminTextarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cx(adminTextareaClass, className)} {...props} />;
  }
);
