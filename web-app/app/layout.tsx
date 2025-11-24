import './globals.css';
import { NavigationBar } from '../components/navigation-bar';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-dark-bg">
          {children}
      </body>
    </html>
  );
}
