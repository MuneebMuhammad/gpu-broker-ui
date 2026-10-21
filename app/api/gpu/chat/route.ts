import { NextResponse } from "next/server";
import { researcherContext, resultReceipt } from "@/lib/requests";
import { isAgentState, parseAgentResult } from "@/lib/broker";

export const maxDuration = 120;

export async function POST(request: Request) {
  const context = await researcherContext();
  if (!context)
    return NextResponse.json(
      { error: "Your session expired. Sign in again." },
      { status: 401 },
    );
  if (!request.headers.get("content-type")?.includes("application/json"))
    return NextResponse.json(
      { error: "Send a JSON message." },
      { status: 400 },
    );
  let body;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 65536)
      return NextResponse.json(
        { error: "Message is too large." },
        { status: 413 },
      );
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid message." }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    Object.keys(body).some((k) => !["message", "state"].includes(k)) ||
    typeof body.message !== "string" ||
    !body.message.trim() ||
    body.message.length > 8000 ||
    (body.state != null && !isAgentState(body.state))
  )
    return NextResponse.json(
      { error: "Please enter a message of up to 8,000 characters." },
      { status: 400 },
    );
  const base = process.env.NEXT_PUBLIC_FLASK_URL?.replace(/\/$/, "");
  if (!base)
    return NextResponse.json(
      { error: "The recommendation service has not been configured." },
      { status: 503 },
    );
  try {
    const upstream = await fetch(`${base}/api/gpu/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: body.message,
        state: body.state ?? null,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(100_000),
    });
    if (!upstream.ok)
      return NextResponse.json(
        {
          error:
            upstream.status === 504
              ? "The agent took too long to respond. Please retry."
              : "The recommendation service could not complete this message. Please retry.",
        },
        { status: upstream.status === 504 ? 504 : 502 },
      );
    const result = parseAgentResult(await upstream.json());
    if (!result)
      return NextResponse.json(
        { error: "The agent returned an incomplete response. Please retry." },
        { status: 502 },
      );
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "X-Result-Receipt": resultReceipt(context.user.id, result),
      },
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name);
    return NextResponse.json(
      {
        error: timedOut
          ? "The agent took too long to respond. Please retry."
          : "Could not reach the recommendation service. Please retry.",
      },
      { status: timedOut ? 504 : 502 },
    );
  }
}
