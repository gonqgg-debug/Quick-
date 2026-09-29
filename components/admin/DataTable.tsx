import type {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { Card } from "@/components/ui/card";
import { TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

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
    <Card className={cn("overflow-hidden shadow-sm", className)}>
      {toolbar}
      <div className="relative w-full overflow-auto">
        <table className={cn("w-full caption-bottom text-sm", tableClassName)}>{children}</table>
      </div>
    </Card>
  );
}

export function DataTableHead({ children }: { children: ReactNode }) {
  return (
    <TableHeader>
      <TableRow className="bg-muted/40 hover:bg-muted/40">{children}</TableRow>
    </TableHeader>
  );
}

type DataTableThProps = ThHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
};

export function DataTableTh({ numeric = false, className, children, ...props }: DataTableThProps) {
  return (
    <TableHead
      className={cn("h-10 px-4 text-muted-foreground", numeric && "whitespace-nowrap text-right tabular-nums", className)}
      {...props}
    >
      {children}
    </TableHead>
  );
}

type DataTableRowProps = HTMLAttributes<HTMLTableRowElement>;

export function DataTableRow({ className, children, ...props }: DataTableRowProps) {
  return (
    <TableRow className={cn(props.onClick && "cursor-pointer", className)} {...props}>
      {children}
    </TableRow>
  );
}

type DataTableCellProps = TdHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
};

export function DataTableCell({ numeric = false, className, children, ...props }: DataTableCellProps) {
  return (
    <TableCell className={cn("px-4 py-3", numeric && "whitespace-nowrap text-right tabular-nums", className)} {...props}>
      {children}
    </TableCell>
  );
}
