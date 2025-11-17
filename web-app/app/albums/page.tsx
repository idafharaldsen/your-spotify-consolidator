'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ExternalLink, Play, Disc, Music } from 'lucide-react';

interface CleanedAlbum {
  duration_ms: number;
  total_duration_ms: number;
  count: number;
  total_count: number;
  differents: number;
  primaryAlbumId: string;
  album: {
    name: string;
    album_type: string;
    artists: string[];
    release_date: string;
    release_date_precision: string;
    popularity: number;
    images: Array<{
      height: number;
      url: string;
      width: number;
    }>;
    external_urls: Record<string, string>;
    genres: string[];
  };
  consolidated_count: number;
  original_albumIds: string[];
  rank: number;
}

interface AlbumsResponse {
  albums: CleanedAlbum[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  metadata: {
    consolidatedTotalAlbums: number;
    originalTotalAlbums: number;
    duplicatesRemoved: number;
    consolidationRate: number;
    totalListeningEvents: number;
    timestamp: string;
    source: string;
  };
}

export default function Albums() {
  const [albums, setAlbums] = useState<CleanedAlbum[]>([]);
  const [metadata, setMetadata] = useState<AlbumsResponse['metadata'] | null>(null);
  const [pagination, setPagination] = useState<AlbumsResponse['pagination'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const fetchAlbums = async (offset: number = 0, limit: number = 20) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/albums?limit=${limit}&offset=${offset}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch albums');
      }
      
      const data = await response.json() as AlbumsResponse;
      setAlbums(data.albums);
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
    fetchAlbums(currentPage * pageSize, pageSize);
  }, [currentPage, pageSize]);

  const formatDuration = (ms: number) => {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
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
          <h1 className="text-3xl font-bold">Top Albums</h1>
          <p className="text-muted-foreground">
            Your most played albums with consolidated data
          </p>
        </div>

        {/* Stats */}
        {metadata && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-card-border bg-card-accent p-6">
              <div className="flex items-center space-x-2">
                <Disc className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Albums</p>
                  <p className="text-2xl font-bold">{metadata.consolidatedTotalAlbums?.toLocaleString() || '0'}</p>
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

        {/* Albums List */}
        <div className="space-y-4">
          {albums.map((album) => (
            <div key={album.primaryAlbumId || `${album.album.artists[0]}-${album.album.name}`} className="flex items-center space-x-4 rounded-lg border border-card-border bg-card-accent p-4 hover:bg-card transition-colors">
              {/* Rank */}
              <div className="flex-shrink-0 w-8 text-center">
                <span className="text-lg font-bold text-muted-foreground">#{album.rank}</span>
              </div>

              {/* Album Art */}
              <div className="flex-shrink-0">
                {album.album.images[0]?.url ? (
                  <Image
                    src={album.album.images[0].url}
                    alt={`${album.album.name} album cover`}
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

              {/* Album Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{album.album.name}</h3>
                <p className="text-muted-foreground truncate">{album.album.artists[0] || 'Unknown Artist'}</p>
              </div>

              {/* Stats */}
              <div className="flex-shrink-0 text-right space-y-1">
                <div className="text-lg font-bold">{formatPlayCount(album.count)}</div>
                <div className="text-sm text-muted-foreground">plays</div>
                <div className="text-sm text-muted-foreground">{formatDuration(album.total_duration_ms)}</div>
              </div>

              {/* Actions */}
              <div className="flex-shrink-0">
                <a
                  href={`https://open.spotify.com/album/${album.primaryAlbumId}`}
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
