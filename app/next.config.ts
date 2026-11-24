import type { NextConfig } from "next";
const config: NextConfig = {
  reactStrictMode: true,
  // Deadlines moved to the top of Programmes, and Calls under Notes: old links keep working.
  async redirects() { return [{ source: "/deadlines", destination: "/programmes#deadlines", permanent: false }, { source: "/calls", destination: "/notes/calls", permanent: false }]; },
};
export default config;
