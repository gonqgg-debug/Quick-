"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminCajaRecuento } from "@/components/admin/AdminCajaRecuento";

const RECUENTO_PATH = "/admin/caja/recuento";

export function AdminCajaPages({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isRecuento = pathname === RECUENTO_PATH;
  const [keepRecuento, setKeepRecuento] = useState(isRecuento);

  useEffect(() => {
    if (isRecuento) {
      setKeepRecuento(true);
    }
  }, [isRecuento]);

  return (
    <>
      {keepRecuento || isRecuento ? (
        <div className={isRecuento ? "block" : "hidden"} aria-hidden={!isRecuento}>
          <AdminCajaRecuento />
        </div>
      ) : null}
      {isRecuento ? null : children}
    </>
  );
}
