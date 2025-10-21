// src/api/click/route.ts
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
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
  // 🎯 Performance tracking
  const perfStart = Date.now();
  const timings: Record<string, number> = {};
  
  // Extract the first (client) IP from x-forwarded-for header
  // Format can be: "client, proxy1, proxy2" or "client"
  const forwardedFor = req.headers.get("x-forwarded-for") || "0.0.0.0";
  const ip = forwardedFor.split(",")[0].trim();
  
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

  const bodyParseStart = Date.now();
  const body = await req.json();
  timings.bodyParse = Date.now() - bodyParseStart;
  
  const {
    event_id,
    page_event_id,
    track_id,
    provider,
    position,
    utms,
    redirect_url,
    event_source_url,
  } = body;

  // 🔁 Deduplication check (ip + track_id + provider)
  const dedupKey = `${ip}-${track_id}-${provider}`;
  const lastClick = dedupCache.get(dedupKey) || 0;
  if (now - lastClick < DEDUP_WINDOW_MS) {
    console.log(`[PERF] Deduplicated request for ${provider}`);
    return NextResponse.redirect(redirect_url, { status: 302 });
  }
  dedupCache.set(dedupKey, now);

  const cookie = req.headers.get("cookie") || "";
  const fbp = cookie.match(/_fbp=([^;]+)/)?.[1] || null;
  const fbc = cookie.match(/_fbc=([^;]+)/)?.[1] || null;

  const visitId = uuidv4();

  // Insert visit record
  const visitInsertStart = Date.now();
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
  timings.visitInsert = Date.now() - visitInsertStart;

  // Insert event record
  const eventInsertStart = Date.now();
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
  timings.eventInsert = Date.now() - eventInsertStart;

  // Build user_data, excluding null values
  const user_data: Record<string, string> = {
    client_ip_address: ip,
    client_user_agent: ua,
  };
  
  if (fbp) user_data.fbp = fbp;
  if (fbc) user_data.fbc = fbc;

  // Custom event for detailed tracking
  const customPayload = {
    event_name: "OutboundClick",
    event_time: Math.floor(Date.now() / 1000),
    event_id,
    action_source: "website",
    event_source_url: event_source_url || "https://www.joshholmesmusic.com",
    user_data,
    custom_data: {
      provider,
      track_id,
      button_pos: position,
      ...utms,
    },
  };

  // Standard Lead conversion event for ad optimization
  const leadPayload = {
    event_name: "Lead",
    event_time: Math.floor(Date.now() / 1000),
    event_id: `${event_id}_lead`,
    action_source: "website",
    event_source_url: event_source_url || "https://www.joshholmesmusic.com",
    user_data,
    custom_data: {
      content_name: `${track_id} - ${provider}`,
      content_category: "music_streaming",
      value: 1.0,
      currency: "USD",
      provider,
      track_id,
      button_pos: position,
      ...utms,
    },
  };

  // Only send to Meta if credentials are configured
  if (process.env.META_PIXEL_ID && process.env.META_CAPI_TOKEN) {
    const metaPayload: Record<string, unknown> = {
      data: [customPayload, leadPayload], // Send both events
      access_token: process.env.META_CAPI_TOKEN,
    };

    // Add test_event_code if in development/testing
    if (process.env.META_TEST_EVENT_CODE) {
      metaPayload.test_event_code = process.env.META_TEST_EVENT_CODE;
    }

    try {
      const metaApiStart = Date.now();
      
      const res = await fetch(CAPI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metaPayload),
      });
      
      timings.metaApiCall = Date.now() - metaApiStart;

      const resBody = await res.json();
      
      if (!res.ok) {
        console.error("Meta CAPI Error:", {
          status: res.status,
          statusText: res.statusText,
          response: resBody,
          customPayload,
          leadPayload,
        });
      } else {
        console.log("Meta CAPI Success:", resBody);
      }
    } catch (error) {
      timings.metaApiCall = Date.now() - (timings.metaApiCall || Date.now());
      console.error("Meta CAPI Request Failed:", error);
    }
  } else {
    console.warn("Meta CAPI credentials not configured");
    timings.metaApiCall = 0;
  }

  // Calculate total duration
  const totalDuration = Date.now() - perfStart;
  timings.total = totalDuration;

  // Log performance metrics
  console.log(`[PERF] Click processing for ${provider}:`, {
    provider,
    track_id,
    timings: {
      bodyParse: `${timings.bodyParse}ms`,
      visitInsert: `${timings.visitInsert}ms`,
      eventInsert: `${timings.eventInsert}ms`,
      metaApiCall: `${timings.metaApiCall}ms`,
      total: `${timings.total}ms`,
    },
    breakdown: {
      supabase: `${timings.visitInsert + timings.eventInsert}ms (${Math.round(((timings.visitInsert + timings.eventInsert) / totalDuration) * 100)}%)`,
      metaApi: `${timings.metaApiCall}ms (${Math.round((timings.metaApiCall / totalDuration) * 100)}%)`,
      overhead: `${totalDuration - timings.visitInsert - timings.eventInsert - timings.metaApiCall}ms`,
    },
  });

  return NextResponse.redirect(redirect_url, { status: 302 });
}
