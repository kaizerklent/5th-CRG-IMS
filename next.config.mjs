/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Note: 'domains' is deprecated, but works in v14. 
    // Using remotePatterns is the modern standard.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
};

export default nextConfig;