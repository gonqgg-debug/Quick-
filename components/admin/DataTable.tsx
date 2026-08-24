import type {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cx } from "@/components/admin/AdminField";

type DataTableProps = {
  children: ReactNode;
  className?: string;
  /** Minimum table width for horizontal scroll, e.g. `min-w-[760px]`. */
  tableClassName?: string;
  /** Optional bar above the table, clipped by the same rounded card. */
  toolbar?: ReactNode;
};

export function DataTable({ children, className, tableClassName, toolbar }: DataTableProps) {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-sm",
        className
      )}
    >
      {toolbar}
      <div className="overflow-x-auto">
        <table className={cx("w-full text-left text-sm", tableClassName)}>{children}</table>
      </div>
    </div>
  );
}

export function DataTableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="bg-[#F9FAFB] text-xs font-medium uppercase tracking-wider text-[#6B7280]">
        {children}
      </tr>
    </thead>
  );
}

type DataTableThProps = ThHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
};

export function DataTableTh({ numeric = false, className, children, ...props }: DataTableThProps) {
  return (
    <th
      className={cx("px-4 py-3 font-medium", numeric && "whitespace-nowrap text-right tabular-nums", className)}
      {...props}
    >
      {children}
    </th>
  );
}

type DataTableRowProps = HTMLAttributes<HTMLTableRowElement>;

export function DataTableRow({ className, children, ...props }: DataTableRowProps) {
  return (
    <tr
      className={cx(
        "border-b border-[#F1F5F9] bg-white last:border-b-0 hover:bg-gray-50",
        props.onClick && "cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

type DataTableCellProps = TdHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
};

export function DataTableCell({ numeric = false, className, children, ...props }: DataTableCellProps) {
  return (
    <td
      className={cx("px-4 py-3", numeric && "whitespace-nowrap text-right tabular-nums", className)}
      {...props}
    >
      {children}
    </td>
  );
}
