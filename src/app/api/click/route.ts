// src/api/click/route.ts
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CAPI_URL = `https://graph.facebook.com/v18.0/${process.env.META_PIXEL_ID}/events`;

const ipAccessMap = new Map<string, number>();
const dedupCache = new Map<string, number>();

const RATE_LIMIT_WINDOW_MS = 1000; // 1s
const DEDUP_WINDOW_MS = 10_000; // 10s

const isBot = (ua: string) => {
  const botPatterns = [
    "bot",
    "crawler",
    "spider",
    "crawling",
    "facebookexternalhit",
    "embedly",
    "slackbot",
    "discordbot",
    "whatsapp",
    "telegrambot",
    "preview",
    "nuzzel",
    "vkShare",
    "bitlybot",
    "Tumblr",
    "Pinterest",
    "SkypeUriPreview",
    "LinkedInBot",
    "Twitterbot",
    "BingPreview",
  ];
  return botPatterns.some((pattern) => ua.toLowerCase().includes(pattern));
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "0.0.0.0";
  const ua = req.headers.get("user-agent") || "";

  // 🚫 Block obvious bots
  if (isBot(ua)) {
    return new NextResponse("Bot blocked", { status: 403 });
  }

  // ⏱️ Rate limit per IP
  const now = Date.now();
  const lastAccess = ipAccessMap.get(ip) || 0;
  if (now - lastAccess < RATE_LIMIT_WINDOW_MS) {
    return new NextResponse("Too many requests", { status: 429 });
  }
  ipAccessMap.set(ip, now);

  const body = await req.json();
  const {
    event_id,
    page_event_id,
    track_id,
    provider,
    position,
    utms,
    redirect_url,
  } = body;

  // 🔁 Deduplication check (ip + track_id + provider)
  const dedupKey = `${ip}-${track_id}-${provider}`;
  const lastClick = dedupCache.get(dedupKey) || 0;
  if (now - lastClick < DEDUP_WINDOW_MS) {
    return NextResponse.redirect(redirect_url, { status: 302 });
  }
  dedupCache.set(dedupKey, now);

  const cookie = req.headers.get("cookie") || "";
  const fbp = cookie.match(/_fbp=([^;]+)/)?.[1] || null;
  const fbc = cookie.match(/_fbc=([^;]+)/)?.[1] || null;

  const visitId = uuidv4();

  await supabase.from("visits").insert([
    {
      id: visitId,
      fbp,
      fbc,
      ip_trunc: ip.split(".").slice(0, 3).join(".") + ".*",
      ua,
      utms,
    },
  ]);

  await supabase.from("events").insert([
    {
      id: event_id,
      visit_id: visitId,
      type: "click",
      provider,
      track_id,
      button_pos: position,
      event_time: new Date().toISOString(),
      meta_event_id: page_event_id,
    },
  ]);

  const capiPayload = {
    event_name: "OutboundClick",
    event_time: Math.floor(Date.now() / 1000),
    event_id,
    action_source: "website",
    user_data: {
      client_ip_address: ip,
      client_user_agent: ua,
      fbp,
      fbc,
    },
    custom_data: {
      provider,
      track_id,
      button_pos: position,
      ...utms,
    },
  };

  const res = await fetch(CAPI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [capiPayload],
      access_token: process.env.META_CAPI_TOKEN!,
    }),
  });

  const resBody = await res.json();
  console.log("Meta CAPI response", resBody);

  return NextResponse.redirect(redirect_url, { status: 302 });
}
