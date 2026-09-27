/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@costopt/shared'],
  output: 'standalone',
};

export default nextConfig;
