import "server-only";

// Customer session — a signed JWT in an httpOnly cookie. In the mock-OTP model
// the customer has no Supabase auth session, so this cookie is how the server
// knows "this request is the verified owner of phone X". Admin/rider use
// Supabase Auth instead (not this).

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "sm_session";
const ISSUER = "slicematic";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET!);

export interface CustomerSession {
  customerId: string;
  phone: string;
  name: string | null;
}

/** Mint the session cookie after a successful (mock) OTP verification. */
export async function setCustomerSession(session: CustomerSession): Promise<void> {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Read + verify the current customer session, or null if absent/invalid. */
export async function getCustomerSession(): Promise<CustomerSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER });
    return {
      customerId: String(payload.customerId),
      phone: String(payload.phone),
      name: (payload.name as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function clearCustomerSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
