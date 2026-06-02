import { NextResponse } from "next/server";

const MAX_LEN = 280;

function feedbackWebhookUrl(): string | null {
  const fromEnv = process.env.DISCORD_FEEDBACK_WEBHOOK_URL?.trim();
  if (fromEnv) return fromEnv;
  // Fallback for deploy — override via DISCORD_FEEDBACK_WEBHOOK_URL in Vercel to rotate
  return "https://discord.com/api/webhooks/1510885593469550724/o1fzs5w36JGW2v4Y1z125nudxAm5Tu_axsqoES4da7YcMBYWgSc7Wu8KcfEELoEoyLr0";
}

export async function POST(request: Request) {
  const webhookUrl = feedbackWebhookUrl();
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "Feedback is not configured." },
      { status: 503 }
    );
  }

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const raw = body.message?.replace(/\s+/g, " ").trim() ?? "";
  if (!raw) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }
  if (raw.length > MAX_LEN) {
    return NextResponse.json(
      { error: `Keep it under ${MAX_LEN} characters.` },
      { status: 400 }
    );
  }

  const content = `**Market Context feedback**\n${raw}`;

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, username: "Market Context" }),
  });

  if (!res.ok) {
    console.error("[feedback] Discord webhook failed:", res.status, await res.text());
    return NextResponse.json(
      { error: "Could not send — try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
