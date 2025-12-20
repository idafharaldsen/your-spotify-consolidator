import './globals.css';
import { SpotifyStatsProvider } from '../components/SpotifyStatsContext';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-dark-surface via-dark-surfaceHover to-surface-800">
        <SpotifyStatsProvider>
          {children}
        </SpotifyStatsProvider>
      </body>
    </html>
  );
}
