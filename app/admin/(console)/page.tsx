import { redirect } from "next/navigation";
import { AdminHome } from "@/components/admin/AdminHome";
import { adminGreetingName, getAdminUser } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inicio | Administración",
  description: "Panel de administración de Quick! Mini Market",
};

export default async function AdminHomePage() {
  const user = await getAdminUser();
  if (!user) {
    redirect("/admin/login");
  }

  return <AdminHome greetingName={adminGreetingName(user)} />;
}
