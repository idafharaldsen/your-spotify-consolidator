'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ExternalLink, Clock, Calendar, Music } from 'lucide-react';

interface RecentPlayEvent {
  songId: string;
  songName: string;
  artistName: string;
  albumName: string;
  playedAt: string;
  msPlayed: number;
  albumImages: Array<{
    height: number;
    url: string;
    width: number;
  }>;
  spotifyUrl: string;
}

interface RecentResponse {
  recentPlays: RecentPlayEvent[];
  metadata: {
    totalEvents: number;
    returnedEvents: number;
    dateRange: {
      earliest: string;
      latest: string;
    };
    lastUpdated: string;
    source: string;
  };
}

export default function Recent() {
  const [recentPlays, setRecentPlays] = useState<RecentPlayEvent[]>([]);
  const [metadata, setMetadata] = useState<RecentResponse['metadata'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecentPlays = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/recent?limit=100');
      
      if (!response.ok) {
        throw new Error('Failed to fetch recent plays');
      }
      
      const data = await response.json() as RecentResponse;
      setRecentPlays(data.recentPlays);
      setMetadata(data.metadata);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentPlays();
  }, []);

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `${diffInMinutes} minutes ago`;
    } else if (diffInHours < 24) {
      const diffInHoursRounded = Math.floor(diffInHours);
      return `${diffInHoursRounded} hours ago`;
    } else if (diffInHours < 24 * 7) {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
  };

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Recent Plays</h1>
          <p className="text-muted-foreground">
            Your most recently played songs
          </p>
        </div>

        {/* Stats */}
        {metadata && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-card-border bg-card-accent p-6">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Recent Plays</p>
                  <p className="text-2xl font-bold">{metadata.returnedEvents?.toLocaleString() || '0'}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-card-border bg-card-accent p-6">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Events</p>
                  <p className="text-2xl font-bold">{metadata.totalEvents?.toLocaleString() || '0'}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-card-border bg-card-accent p-6">
              <div className="flex items-center space-x-2">
                <div className="h-4 w-4 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date Range</p>
                  <p className="text-sm font-bold">
                    {metadata.dateRange?.earliest ? new Date(metadata.dateRange.earliest).toLocaleDateString() : 'N/A'} - {metadata.dateRange?.latest ? new Date(metadata.dateRange.latest).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-card-border bg-card-accent p-6">
              <div className="flex items-center space-x-2">
                <div className="h-4 w-4 bg-green-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                  <p className="text-sm font-bold">
                    {metadata.lastUpdated ? new Date(metadata.lastUpdated).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Plays List */}
        <div className="space-y-3">
          {recentPlays.map((play, index) => (
            <div key={`${play.songId}-${play.playedAt}`} className="flex items-center space-x-4 rounded-lg border border-card-border bg-card-accent p-4 hover:bg-card transition-colors">
              {/* Rank/Index */}
              <div className="flex-shrink-0 w-8 text-center">
                <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
              </div>

              {/* Album Art */}
              <div className="flex-shrink-0">
                {play.albumImages[0]?.url ? (
                  <Image
                    src={play.albumImages[0].url}
                    alt={`${play.albumName} album cover`}
                    width={48}
                    height={48}
                    className="rounded-md"
                  />
                ) : (
                  <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                    <Music className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Song Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{play.songName}</h3>
                <p className="text-muted-foreground truncate">{play.artistName}</p>
                <p className="text-sm text-muted-foreground truncate">{play.albumName}</p>
              </div>

              {/* Time Info */}
              <div className="flex-shrink-0 text-right space-y-1">
                <div className="text-sm font-medium">{formatDateTime(play.playedAt)}</div>
                <div className="text-xs text-muted-foreground">{formatDuration(play.msPlayed)}</div>
              </div>

              {/* Actions */}
              <div className="flex-shrink-0">
                <a
                  href={play.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Spotify</span>
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Refresh Button */}
        <div className="text-center">
          <button
            onClick={fetchRecentPlays}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Refresh Recent Plays
          </button>
        </div>
      </div>
    </main>
  );
}
