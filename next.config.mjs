/** @type {import('next').NextConfig} */
// Server actions accept the 2 MB medical certificate upload (default limit is 1 MB).
const nextConfig = { reactStrictMode: true, experimental: { serverActions: { bodySizeLimit: '3mb' } } };
export default nextConfig;
