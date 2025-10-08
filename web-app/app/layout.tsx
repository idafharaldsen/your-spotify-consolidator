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
        <NavigationBar />
        <div className="bg-dark-surface rounded-lg mx-4  p-6 h-[calc(100vh-8rem)] border border-dark-border overflow-y-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
