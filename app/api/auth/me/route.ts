import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/session";

export async function GET() {
  const session = await getCustomerSession();
  return NextResponse.json({ session });
}
