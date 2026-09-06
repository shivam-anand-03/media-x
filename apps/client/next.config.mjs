/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],

  images: {
    unoptimized: true,
  },

  ...(process.env.NODE_ENV !== "production"
    ? {
        allowedDevOrigins: ["*"],
      }
    : {}),
};

export default nextConfig;