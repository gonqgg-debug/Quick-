import type { Metadata } from "next";
import { PropuestaDeck } from "@/components/propuesta/PropuestaDeck";
import "./propuesta.css";

export const metadata: Metadata = {
  title: "Propuesta comercial | Quick! Mini Market",
  description:
    "Mini markets de cadena para residenciales y locales. Operación, servicio, tecnología, PharmaQuick! y plan de crecimiento en Pueblo Bávaro.",
};

export default function PropuestaPage() {
  return <PropuestaDeck />;
}
