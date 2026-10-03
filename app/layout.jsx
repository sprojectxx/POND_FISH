import './globals.css';

export const metadata = {
  title: 'PondFish Digital Ecosystem',
  description: 'Single Store + One Truck Premium Fresh Fish Ordering, Subscriptions, and Retail Portal',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
