import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Vercel Blob (subidas desde el CMS)
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      // CDN de Readymag: solo mientras se migran los assets originales
      { protocol: 'https', hostname: 'c-p.rmcdn.net' },
      { protocol: 'https', hostname: 'i-p.rmcdn.net' },
    ],
  },
  experimental: {
    // el editor de canvas del CMS depende de acciones de servidor con payloads grandes
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
