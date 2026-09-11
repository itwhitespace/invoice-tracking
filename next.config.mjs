/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow canvas/PDF processing in webpack if needed
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
