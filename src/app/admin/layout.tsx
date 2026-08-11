import type { Metadata } from 'next';
import './admin.css';

export const metadata: Metadata = {
  title: 'CMS',
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin">{children}</div>;
}
