import { NextResponse } from "next/server";
import { federatedLogoutUrl } from "@/auth";

// Returns the provider end-session URL for the caller's current session. POST
// only; the response is readable only by same-origin script and is never cached.
export async function POST(request: Request) {
  const url = await federatedLogoutUrl(request);
  return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
}
