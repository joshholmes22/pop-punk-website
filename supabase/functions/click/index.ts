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
    const { event_id, visit_id, track_id, provider, position, event_type } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (event_type === "pageview") {
      // Just create a visit
      await supabase.from("visits").insert([{ id: visit_id }]);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    if (event_type === "click") {
      // Check if visit exists, create if missing
      const { data: existingVisit } = await supabase
        .from("visits")
        .select("id")
        .eq("id", visit_id)
        .single();

      if (!existingVisit) {
        await supabase.from("visits").insert([{ id: visit_id }]);
      }

      // Log the click
      await supabase.from("events").insert([
        {
          id: event_id,
          visit_id,
          type: "click",
          provider,
          track_id,
          button_pos: position,
          event_time: new Date().toISOString(),
        },
      ]);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
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