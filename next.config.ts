import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `next dev` only answers dev-asset requests from the origin it was started
  // on (localhost). Add the LAN address so the site can be opened from a phone
  // on the same network — which is the only way to try the on-screen pad.
  // Development only; `next start` ignores this.
  allowedDevOrigins: ['192.168.1.40'],

  experimental: {
    // Every route lives under app/[lang], so there is no root layout for Next
    // to build a 404 from when a URL matches nothing at all. See
    // app/global-not-found.tsx.
    globalNotFound: true
  }
};

export default nextConfig;
