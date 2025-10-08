'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ExternalLink, Play, Music } from 'lucide-react';

interface CleanedSong {
  duration_ms: number;
  count: number;
  songId: string;
  song: {
    name: string;
    preview_url: string | null;
    external_urls: Record<string, string>;
  };
  album: {
    name: string;
    images: Array<{
      height: number;
      url: string;
      width: number;
    }>;
  };
  artist: {
    name: string;
    genres: string[];
  };
  consolidated_count: number;
  original_songIds: string[];
  original_counts: number[];
  rank: number;
}

interface SongsResponse {
  songs: CleanedSong[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  metadata: {
    totalSongs: number;
    originalTotalSongs: number;
    duplicatesRemoved: number;
    consolidationRate: number;
    totalListeningEvents: number;
    timestamp: string;
    source: string;
  };
}

export default function Songs() {
  const [songs, setSongs] = useState<CleanedSong[]>([]);
  const [metadata, setMetadata] = useState<SongsResponse['metadata'] | null>(null);
  const [pagination, setPagination] = useState<SongsResponse['pagination'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const fetchSongs = async (offset: number = 0, limit: number = 20) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/songs?limit=${limit}&offset=${offset}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch songs');
      }
      
      const data = await response.json() as SongsResponse;
      setSongs(data.songs);
      setMetadata(data.metadata);
      setPagination(data.pagination);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs(currentPage * pageSize, pageSize);
  }, [currentPage, pageSize]);

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatPlayCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(0);
  };

  const handlePageSizeSelectChange = (e: any) => {
    handlePageSizeChange(Number(e.target.value));
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
          <h1 className="text-3xl font-bold">Top Songs</h1>
          <p className="text-muted-foreground">
            Your most played songs with consolidated data
          </p>
        </div>

        {/* Stats */}
        {metadata && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-card-border bg-card-accent p-6">
              <div className="flex items-center space-x-2">
                <Music className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Songs</p>
                  <p className="text-2xl font-bold">{metadata.totalSongs?.toLocaleString() || '0'}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-card-border bg-card-accent p-6">
              <div className="flex items-center space-x-2">
                <Play className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Plays</p>
                  <p className="text-2xl font-bold">{metadata.totalListeningEvents?.toLocaleString() || '0'}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-card-border bg-card-accent p-6">
              <div className="flex items-center space-x-2">
                <div className="h-4 w-4 bg-green-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Duplicates Removed</p>
                  <p className="text-2xl font-bold">{metadata.duplicatesRemoved?.toLocaleString() || '0'}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-card-border bg-card-accent p-6">
              <div className="flex items-center space-x-2">
                <div className="h-4 w-4 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Consolidation Rate</p>
                  <p className="text-2xl font-bold">{metadata.consolidationRate?.toFixed(1) || '0.0'}%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Songs List */}
        <div className="space-y-4">
          {songs.map((song) => (
            <div key={song.songId} className="flex items-center space-x-4 rounded-lg border border-card-border bg-card-accent p-4 hover:bg-card transition-colors">
              {/* Rank */}
              <div className="flex-shrink-0 w-8 text-center">
                <span className="text-lg font-bold text-muted-foreground">#{song.rank}</span>
              </div>

              {/* Album Art */}
              <div className="flex-shrink-0">
                {song.album.images[0]?.url ? (
                  <Image
                    src={song.album.images[0].url}
                    alt={`${song.album.name} album cover`}
                    width={64}
                    height={64}
                    className="rounded-md"
                  />
                ) : (
                  <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center">
                    <Music className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Song Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{song.song.name}</h3>
                <p className="text-muted-foreground truncate">{song.artist.name}</p>
                <p className="text-sm text-muted-foreground truncate">{song.album.name}</p>
                {song.consolidated_count > 1 && (
                  <p className="text-xs text-blue-600">
                    Consolidated from {song.consolidated_count} versions
                  </p>
                )}
              </div>

              {/* Stats */}
              <div className="flex-shrink-0 text-right space-y-1">
                <div className="text-lg font-bold">{formatPlayCount(song.count)}</div>
                <div className="text-sm text-muted-foreground">plays</div>
                <div className="text-sm text-muted-foreground">{formatDuration(song.duration_ms)}</div>
              </div>

              {/* Actions */}
              <div className="flex-shrink-0">
                <a
                  href={song.song.external_urls.spotify}
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

        {/* Pagination */}
        {pagination && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Show</span>
              <select
                value={pageSize}
                onChange={handlePageSizeSelectChange}
                className="rounded border px-2 py-1 text-sm"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-muted-foreground">per page</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage + 1} of {Math.ceil(pagination.total / pageSize)}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!pagination.hasMore}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
  