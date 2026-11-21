import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata = {
  title: 'PondFish | Freshwater fish, harvested daily',
  description: 'Single Store + One Dedicated Truck Premium Fresh Fish Ordering, Subscriptions, and Retail Portal',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <head>
        <link rel="preconnect" href="https://pondfish-cdn.sprojectxx.workers.dev" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://pondfish-cdn.sprojectxx.workers.dev" />
      </head>
      <body className={jakarta.className} suppressHydrationWarning>{children}</body>
    </html>
  );
}
