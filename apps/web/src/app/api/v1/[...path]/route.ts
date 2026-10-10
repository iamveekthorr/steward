import { NextRequest, NextResponse } from "next/server";

// Runtime env var — set in Cloudflare Pages dashboard.
// e.g. API_URL = https://api.yourdomain.com
// All /api/v1/* requests from the frontend are forwarded here.
const API_URL = (process.env.API_URL ?? "").replace(/\/$/, "");

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  if (!API_URL) {
    console.error("[proxy] API_URL is not set — configure it in the Cloudflare Pages dashboard.");
    return NextResponse.json(
      { status: false, message: "Service unavailable. Please try again later." },
      { status: 503 },
    );
  }

  const targetPath = `/api/v1/${path.join("/")}`;
  const targetUrl = new URL(targetPath, API_URL);

  // Forward query params.
  req.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  const outHeaders = new Headers();
  for (const [key, value] of req.headers.entries()) {
    // Drop hop-by-hop headers; keep Authorization, Content-Type, Cookie, etc.
    if (!["host", "connection", "transfer-encoding", "te", "upgrade", "keep-alive"].includes(key.toLowerCase())) {
      outHeaders.set(key, value);
    }
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: outHeaders,
      body,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream unreachable";
    return NextResponse.json({ status: false, message }, { status: 502 });
  }

  const responseHeaders = new Headers();
  for (const [key, value] of upstream.headers.entries()) {
    if (!["transfer-encoding", "connection"].includes(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  }

  const responseBody = await upstream.arrayBuffer();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  return proxy(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: RouteContext) {
  return proxy(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  return proxy(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: RouteContext) {
  return proxy(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  return proxy(req, (await ctx.params).path);
}
