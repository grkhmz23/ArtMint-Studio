/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@resvg/resvg-js"],
  },
  transpilePackages: [
    "@artmint/common",
    "@artmint/render",
    "@artmint/ai",
    "@artmint/exchangeart",
  ],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
