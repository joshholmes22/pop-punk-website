"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import Image from "next/image";

const TRACK_ID = "say-yes";

const PLATFORMS = [
  {
    name: "Spotify",
    provider: "spotify",
    url: "https://open.spotify.com/album/6J9HevGlG19p566hxZnIwH",
    color: "#1ED760",
    icon: "/icons/spotify.svg",
  },
  {
    name: "Apple Music",
    provider: "apple",
    url: "https://music.apple.com/gb/album/say-yes-single/1818304777",
    color: "#FF4E6B",
    icon: "/icons/apple-music.svg",
  },
  {
    name: "YouTube",
    provider: "youtube",
    url: "https://www.youtube.com/playlist?list=OLAK5uy_lhwH0Vot2qcESzMu5W1mEc_x4QnC5xjC8",
    color: "#FF0033",
    icon: "/icons/youtube.svg",
  },
  {
    name: "Deezer",
    provider: "deezer",
    url: "https://www.deezer.com/en/album/766717521",
    color: "#a238ff",
    icon: "/icons/deezer.svg",
  },
];

const SOCIALS = [
  {
    name: "Instagram",
    url: "https://instagram.com/joshholmesmusic",
    icon: "/icons/instagram.svg",
  },
  {
    name: "TikTok",
    url: "https://tiktok.com/@joshholmesmusic",
    icon: "/icons/tiktok.svg",
  },
  {
    name: "YouTube",
    url: "https://www.youtube.com/channel/yourchannel",
    icon: "/icons/youtube.svg",
  },
  {
    name: "Spotify",
    url: "https://open.spotify.com/artist/6WHV4DhU159XY7zpEKWV0i?si=z4IFccTBTEmXffkriNeuXA",
    icon: "/icons/spotify.svg",
  },
];

export default function SayYesPage() {
  const [showMore, setShowMore] = useState(false);
  const [delayedShowMore, setDelayedShowMore] = useState(false);
  const searchParams = useSearchParams();

  // Generate visit ID once per page load
  const [visitId] = useState(() => uuidv4());

  const utms: Record<string, string> = {};
  searchParams.forEach((val, key) => (utms[key] = val));

  useEffect(() => {
    // Track PageView with Meta Pixel
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "PageView");
    }

    // Create visit record in database on page load
    const createVisit = async () => {
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/click`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              visit_id: visitId,
              track_id: TRACK_ID,
              event_type: "pageview",
              utms,
              event_source_url: window.location.href,
            }),
          }
        );
      } catch (err) {
        console.error("Error creating visit:", err);
      }
    };

    createVisit();

    // Delay "More Platforms" visibility by 3 seconds
    const timer = setTimeout(() => {
      setDelayedShowMore(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [utms]);

  const handleClick = async (
    provider: string,
    url: string,
    position: "hero" | "list"
  ) => {
    const eventId = uuidv4();

    if (typeof window !== "undefined" && window.fbq) {
      // Track as custom event for detailed tracking
      window.fbq("trackCustom", "OutboundClick", {
        provider,
        track_id: TRACK_ID,
        position,
        event_id: eventId,
      });

      // Also track as standard Lead event for ad optimization
      window.fbq("track", "Lead", {
        content_name: `${TRACK_ID} - ${provider}`,
        content_category: "music_streaming",
        value: 1.0,
        currency: "USD",
        event_id: `${eventId}_lead`,
      });
    }

    const body = {
      event_id: eventId,
      visit_id: visitId, // Link to the visit created on page load
      track_id: TRACK_ID,
      provider,
      position,
      event_type: "click",
      utms,
      redirect_url: url,
      event_source_url:
        typeof window !== "undefined" ? window.location.href : undefined,
    };

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/click`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify(body),
        }
      );

      window.location.href = url;
    } catch (err) {
      console.error("Error logging click:", err);
      // Still redirect to platform even if tracking fails
      window.location.href = url;
    }
  };

  const spotify = PLATFORMS.find((p) => p.provider === "spotify")!;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black">
      <div className="absolute inset-0">
        <Image
          src="/artwork/say-yes.png"
          alt="Background"
          fill
          className="object-cover blur-2xl scale-110 brightness-50"
          priority
        />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      </div>

      <main className="relative z-10 flex items-center justify-center min-h-screen px-4 py-12">
        <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-xl p-6 text-center space-y-4 animate-fadeInUp">
          <Image
            src="/artwork/say-yes.png"
            alt="Say Yes Cover"
            width={180}
            height={180}
            className="mx-auto rounded-lg shadow-md object-cover border border-white/20"
            priority
          />

          <div>
            <h1 className="text-2xl font-bold text-white">
              Say Yes - Josh Holmes
            </h1>
            <p className="text-base text-white/90 mt-2 font-medium">
              The UK pop punk sound you've been missing 🎸🇬🇧
            </p>
            <p className="text-sm text-white/70 mt-1">
              700,000+ streams worldwide 🌍
            </p>
          </div>

          <button
            onClick={() => handleClick(spotify.provider, spotify.url, "hero")}
            style={{ backgroundColor: spotify.color }}
            className="w-full py-3.5 text-white text-lg font-bold rounded-xl shadow-lg transition hover:brightness-110 hover:scale-105 flex items-center justify-center gap-2 cursor-pointer animate-pulse-subtle"
          >
            <Image
              src={spotify.icon}
              alt={spotify.provider}
              width={24}
              height={24}
            />
            🎧 Listen on {spotify.name}
          </button>

          {delayedShowMore && (
            <button
              onClick={() => setShowMore(!showMore)}
              className="text-sm text-white/60 hover:text-white/90 underline cursor-pointer transition"
            >
              {showMore ? "Hide other platforms" : "More Platforms"}
            </button>
          )}

          {showMore && (
            <ul className="space-y-2 pt-2 animate-fadeIn">
              {PLATFORMS.filter((p) => p.provider !== "spotify").map((p) => (
                <li key={p.provider}>
                  <button
                    onClick={() => handleClick(p.provider, p.url, "list")}
                    style={{ backgroundColor: p.color }}
                    className="w-full py-2.5 text-white font-semibold rounded-xl shadow transition hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Image src={p.icon} alt={p.name} width={20} height={20} />{" "}
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-center gap-4 pt-6">
            {SOCIALS.map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-80 hover:opacity-100 transition cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.icon} alt={s.name} className="w-6 h-6" />
              </a>
            ))}
          </div>

          {/* Meta noscript pixel */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${process.env.NEXT_PUBLIC_META_PIXEL_ID}&ev=PageView&noscript=1`}
            alt="fb pixel"
          />
        </div>
      </main>
    </div>
  );
}
