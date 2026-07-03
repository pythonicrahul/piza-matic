import { NextResponse } from "next/server";
import { validateName, validatePhone } from "@/lib/validators";
import { getOrCreateCustomer } from "@/lib/data/customers";
import { setCustomerSession } from "@/lib/session";

// Verify the OTP and start a customer session. Mock mode accepts the fixed dev
// code; name is optional but validated if present.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const phone = validatePhone(body?.phone);
  if (!phone.ok) return NextResponse.json({ ok: false, error: phone.error }, { status: 400 });

  const name = validateName(body?.name);
  if (!name.ok) return NextResponse.json({ ok: false, error: name.error }, { status: 400 });

  const code = String(body?.code ?? "").trim();
  const mock = process.env.OTP_MOCK !== "false";
  if (!mock) {
    return NextResponse.json({ ok: false, error: "SMS provider not configured." }, { status: 501 });
  }
  if (code !== (process.env.OTP_DEV_CODE ?? "123456")) {
    return NextResponse.json({ ok: false, error: "Incorrect code. Please try again." }, { status: 401 });
  }

  try {
    const customer = await getOrCreateCustomer(phone.value, name.value || null);
    await setCustomerSession({
      customerId: customer.id,
      phone: customer.phone,
      name: customer.name,
    });
    return NextResponse.json({ ok: true, customer });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not sign you in. Please try again." },
      { status: 500 },
    );
  }
}
