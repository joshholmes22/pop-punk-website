// supabase/functions/click/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { v4 as uuidv4 } from "https://deno.land/std/uuid/mod.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const ip = req.headers.get("x-forwarded-for") || "0.0.0.0";
  const ua = req.headers.get("user-agent") || "";
  const cookie = req.headers.get("cookie") || "";
  const fbp = cookie.match(/_fbp=([^;]+)/)?.[1] || null;
  const fbc = cookie.match(/_fbc=([^;]+)/)?.[1] || null;

  const visitId = uuidv4.generate();

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

  // Call Meta CAPI
  const payload = {
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

  const res = await fetch(
    `https://graph.facebook.com/v18.0/${Deno.env.get("META_PIXEL_ID")}/events`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [payload],
        access_token: Deno.env.get("META_CAPI_TOKEN")!,
      }),
    }
  );

  if (!res.ok) {
    console.error("Meta CAPI response", await res.json());
  }

  return new Response(null, {
    status: 302,
    headers: { Location: redirect_url },
  });
});