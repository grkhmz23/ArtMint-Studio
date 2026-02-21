/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@resvg/resvg-js"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: [
    "@artmint/common",
    "@artmint/render",
    "@artmint/ai",
    "@artmint/exchangeart",
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "pino-pretty": false,
    };
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
