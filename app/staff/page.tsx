import { StaffPanel } from "@/components/staff/StaffPanel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pedidos | Personal",
  description: "Panel interno de pedidos Quick! Mini Market",
};

export default function StaffPage() {
  return <StaffPanel />;
}
