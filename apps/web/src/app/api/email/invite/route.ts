import { type NextRequest, NextResponse } from "next/server";
import { sendWorkerInviteEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.to || !body?.managerName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const inviteUrl = body.token
    ? `${appUrl}/invite/${body.token as string}`
    : body.inviteUrl ?? `${appUrl}/invite`;

  const { data, error } = await sendWorkerInviteEmail({
    to: body.to as string,
    managerName: body.managerName as string,
    inviteUrl: inviteUrl as string,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data?.id });
}
