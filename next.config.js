const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  // Don't advertise the framework in response headers.
  poweredByHeader: false,

  // Gzip/Brotli compression for all responses.
  compress: true,

  compiler: {
    styledComponents: true,
  },

  // WebP and AVIF are smaller than JPEG/PNG for equivalent quality.
  // Applies to any <Image> component usage and the built-in image optimiser.
  images: {
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 31536000,
  },
};

module.exports = withBundleAnalyzer(nextConfig);
