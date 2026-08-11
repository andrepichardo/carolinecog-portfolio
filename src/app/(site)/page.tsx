import type { Metadata } from 'next';
import { PageCanvas, pageMetadata } from '@/components/site/PageCanvas';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata('');
}

export default function HomePage() {
  return <PageCanvas slug="" />;
}
