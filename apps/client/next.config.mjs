/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/motion", "@workspace/renderer"],

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