import { StaffHistory } from "@/components/staff/StaffHistory";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Historial | Personal",
  description: "Historial de pedidos Quick! Mini Market",
};

export default function StaffHistorialPage() {
  return <StaffHistory />;
}
