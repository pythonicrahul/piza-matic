import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/session";
import { addCustomerAddress, deleteCustomerAddress, getCustomerAddresses } from "@/lib/data/addresses";

// The signed-in customer's saved addresses. All operations are session-scoped.
export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ ok: false, addresses: [] }, { status: 401 });
  const addresses = await getCustomerAddresses(session.customerId);
  return NextResponse.json({ ok: true, addresses });
}

export async function POST(req: Request) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, error: "Invalid location." }, { status: 400 });
  }
  const label = typeof body?.label === "string" ? body.label.slice(0, 40) : null;
  const address = typeof body?.address === "string" ? body.address.slice(0, 200) : null;

  const saved = await addCustomerAddress(session.customerId, { label, address, lat, lng });
  return NextResponse.json({ ok: true, address: saved });
}

export async function DELETE(req: Request) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
  await deleteCustomerAddress(session.customerId, id);
  return NextResponse.json({ ok: true });
}
