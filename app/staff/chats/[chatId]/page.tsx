import { StaffChatThread } from "@/components/staff/StaffChatThread";

export const dynamic = "force-dynamic";

type StaffChatPageProps = {
  params: {
    chatId: string;
  };
};

export const metadata = {
  title: "Chat | Personal",
};

export default function StaffChatPage({ params }: StaffChatPageProps) {
  return <StaffChatThread chatId={params.chatId} />;
}
