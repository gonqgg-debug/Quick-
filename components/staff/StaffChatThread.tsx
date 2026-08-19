"use client";

import { StaffChatsList } from "@/components/staff/StaffChatsList";

export function StaffChatThread({ chatId }: { chatId: string }) {
  return <StaffChatsList initialChatId={chatId} />;
}
