import { StaffChatsList } from "@/components/staff/StaffChatsList";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Conversaciones | Personal",
  description: "Chats de WhatsApp en espera de una persona",
};

export default function StaffChatsPage() {
  return <StaffChatsList />;
}
