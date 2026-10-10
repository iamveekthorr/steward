import { type NextRequest, NextResponse } from "next/server";
import { sendEmailVerificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.to || !body?.name || !body?.token) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const verificationUrl = `${appUrl}/verify-email?token=${body.token as string}`;

  const { data, error } = await sendEmailVerificationEmail({
    to: body.to as string,
    name: body.name as string,
    verificationUrl,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data?.id });
}
