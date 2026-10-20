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

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className={jakarta.className}>{children}</body>
    </html>
  );
}
