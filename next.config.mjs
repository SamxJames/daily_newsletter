/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fonts are linked directly rather than inlined at build time, so the build
  // has no network dependency and cannot fail on a font CDN hiccup in CI.
  optimizeFonts: false,
};
export default nextConfig;
