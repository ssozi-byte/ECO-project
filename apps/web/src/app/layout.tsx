import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CostOpt — Cloud Cost Optimization',
  description:
    'Ingest billing exports, visualize spend, and get explainable savings recommendations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
