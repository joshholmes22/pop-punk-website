/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-inline' https://connect.facebook.net https://www.googletagmanager.com https://analytics.tiktok.com https://open.spotifycdn.com https://t.contentsquare.net https://analytics.tiktok.com;
              style-src 'self' 'unsafe-inline';
              img-src * data: blob:;
              connect-src *;
              font-src 'self' https://fonts.gstatic.com;
              frame-src *;
            `.replace(/\s{2,}/g, " ").trim(),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;