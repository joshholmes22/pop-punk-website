import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center font-sans overflow-hidden">
      {/* Hero Section with glassmorphism */}
      <section className="w-full flex justify-center pt-12 pb-16 px-4">
        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl px-8 py-2 sm:p-12 text-center shadow-2xl w-full max-w-2xl">
          {/* Logo */}
          <Image
            src="/icons/josh-logo.svg"
            alt="Josh Holmes Logo"
            width={280}
            height={140}
            className="mx-auto drop-shadow-lg"
            priority
          />

          {/* Tagline */}
          <p className="text-lg sm:text-xl text-gray-300 mb-6">
            New Single <span className="text-white font-bold">“Say Yes”</span>{" "}
            Out Now
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://www.joshholmesmusic.com/music/say-yes"
              rel="noopener noreferrer"
              className="bg-white text-black px-6 py-3 rounded-full text-sm font-semibold hover:bg-gray-200 transition"
            >
              Listen Now
            </a>
            <a
              href="https://instagram.com/joshholmesmusic"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-white hover:text-black transition"
            >
              Follow on Instagram
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-gray-500">
        © {new Date().getFullYear()} Josh Holmes
      </footer>
    </div>
  );
}
