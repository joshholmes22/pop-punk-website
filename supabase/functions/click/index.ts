import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FRONTEND_ORIGIN = "https://www.joshholmesmusic.com";
const LOCALHOST_ORIGIN = "http://localhost:3000";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders(),
    });
  }

  try {
    const body = await req.json();

    const {
      event_id,
      visit_id,
      page_event_id,
      track_id,
      provider,
      position,
      event_type, // 'pageview' or 'click'
      utms,
      redirect_url,
      event_source_url,
    } = body;

    // Validate Meta credentials
    const metaPixelId = Deno.env.get("META_PIXEL_ID");
    const metaCapiToken = Deno.env.get("META_CAPI_TOKEN");
    
    if (!metaPixelId || !metaCapiToken) {
      console.error("Missing Meta credentials: META_PIXEL_ID or META_CAPI_TOKEN");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Extract the first (client) IP from x-forwarded-for header
    // Format can be: "client, proxy1, proxy2" or "client"
    const forwardedFor = req.headers.get("x-forwarded-for") || "0.0.0.0";
    const ip = forwardedFor.split(",")[0].trim();
    
    const ua = req.headers.get("user-agent") || "";
    const cookie = req.headers.get("cookie") || "";
    const fbp = cookie.match(/_fbp=([^;]+)/)?.[1] || null;
    const fbc = cookie.match(/_fbc=([^;]+)/)?.[1] || null;

    // Determine if this is a pageview (create visit) or click (create event only)
    if (event_type === "pageview") {
      console.log(`Creating visit ${visit_id} for track ${track_id}`);
      
      // Create visit record on page load
      const visitResult = await supabase.from("visits").insert([
        {
          id: visit_id,
          fbp,
          fbc,
          ip_trunc: ip.split(".").slice(0, 3).join(".") + ".*",
          ua,
          utms,
        },
      ]);

      if (visitResult.error) {
        console.error("Visit insert error:", visitResult.error);
        throw new Error(`Visit insert failed: ${visitResult.error.message}`);
      }

      console.log(`✅ Successfully created visit ${visit_id} for track ${track_id}`);

      return new Response(JSON.stringify({ success: true, visit_id }), {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json",
        },
      });
    }

    // For clicks, create event linked to existing visit
    if (event_type === "click") {
      const eventResult = await supabase.from("events").insert([
        {
          id: event_id,
          visit_id: visit_id, // Use visit_id from page load
          type: "click",
          provider,
          track_id,
          button_pos: position,
          event_time: new Date().toISOString(),
          meta_event_id: page_event_id,
        },
      ]);
      
      if (eventResult.error) {
        console.error("Event insert error:", eventResult.error);
        throw new Error(`Event insert failed: ${eventResult.error.message}`);
      }

      console.log(`Logged ${provider} click for visit ${visit_id}`);

      // Only send Meta CAPI for clicks, not pageviews
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
        event_source_url: event_source_url || FRONTEND_ORIGIN,
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
        event_source_url: event_source_url || FRONTEND_ORIGIN,
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

      // Only send to Meta if credentials are available
      // Fire-and-forget: Don't wait for Meta API response to speed up redirect
      if (metaPixelId && metaCapiToken) {
        const metaPayload: Record<string, unknown> = {
          data: [customPayload, leadPayload], // Send both events
          access_token: metaCapiToken,
        };

        // Add test_event_code if in development/testing
        const testEventCode = Deno.env.get("META_TEST_EVENT_CODE");
        if (testEventCode) {
          metaPayload.test_event_code = testEventCode;
        }

        // Fire and forget - don't await! This makes the response much faster
        fetch(
          `https://graph.facebook.com/v18.0/${metaPixelId}/events`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(metaPayload),
          }
        ).then(async (res) => {
          const metaResponse = await res.json();
          if (!res.ok) {
            console.error("Meta CAPI Error:", {
              status: res.status,
              statusText: res.statusText,
              response: metaResponse,
              customPayload,
              leadPayload,
            });
          } else {
            console.log("Meta CAPI Success:", metaResponse);
          }
        }).catch((error) => {
          console.error("Meta CAPI Request Failed:", error);
        });
      }
    } // Close the if (event_type === "click") block

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json",
      },
    });
  }
});

function corsHeaders(): HeadersInit {
  // Allow both production and localhost origins
  return {
    "Access-Control-Allow-Origin": "*", // Or use the origin from the request
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
  };
}