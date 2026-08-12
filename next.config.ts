import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Todas las imágenes viven en Vercel Blob: las originales se migraron con
    // `yarn assets:upload` y las nuevas las sube el CMS al mismo store.
    remotePatterns: [{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }],
  },
  experimental: {
    // el editor de canvas del CMS depende de acciones de servidor con payloads grandes
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
