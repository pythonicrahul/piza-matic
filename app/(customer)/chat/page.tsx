import { getTopPicks } from "@/lib/data/signals";
import { ChatOrder } from "@/components/chat-order";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  let topPick: string | null = null;
  try {
    const picks = await getTopPicks(1);
    topPick = picks[0]?.pizza ?? null;
  } catch {
    topPick = null;
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-extrabold">✨ Order with Sage</h1>
        <p className="text-sm text-muted">Tell me your mood — I&apos;ll build your perfect pizza.</p>
      </div>
      <ChatOrder topPick={topPick} />
    </div>
  );
}
