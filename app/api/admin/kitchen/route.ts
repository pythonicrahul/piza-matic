import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth/admin";
import { getKitchen } from "@/lib/data/admin";

// Live kitchen feed (polled by the board). Admin-only.
export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const board = await getKitchen();
  return NextResponse.json(board);
}
