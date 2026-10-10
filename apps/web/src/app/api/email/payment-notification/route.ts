import { type NextRequest, NextResponse } from "next/server";
import { sendPaymentNotificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.to || !body?.workerName || !body?.amount || !body?.currency || !body?.payDate || !body?.managerName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await sendPaymentNotificationEmail({
    to: body.to as string,
    workerName: body.workerName as string,
    amount: body.amount as string,
    currency: body.currency as string,
    payDate: body.payDate as string,
    managerName: body.managerName as string,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data?.id });
}
