import type { Metadata } from "next";
import { Suspense } from "react";
import { Chat } from "./Chat";

export const metadata: Metadata = { title: "Messages" };

// /app/chat → everyone in your network; /app/chat/?p=UB-XXXXXX → one conversation.
export default function ChatPage() {
  return (
    <Suspense>
      <Chat />
    </Suspense>
  );
}
