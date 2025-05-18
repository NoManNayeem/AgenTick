// frontend/app/layout.js
import './globals.css';

export const metadata = {
  title: 'AgenTick',
  description: 'Real-time agentic chat POC',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
