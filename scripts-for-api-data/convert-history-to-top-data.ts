#!/usr/bin/env tsx

/**
 * Script to convert merged streaming history to top-songs, top-albums, and top-artists format
 * This creates the input files needed by the cleaning scripts
 */

import fs from 'fs';
import { glob } from 'glob';

interface CompleteSong {
  songId: string;
  name: string;
  duration_ms: number;
  artists: string[];
  album: {
    id: string;
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
  external_urls: {
    spotify: string;
  };
  preview_url: string | null;
  playCount: number;
  totalListeningTime: number;
  listeningEvents: Array<{
    playedAt: string;
    msPlayed: number;
  }>;
}

interface MergedStreamingHistory {
  metadata: {
    totalSongs: number;
    totalPlayEvents: number;
    dateRange: {
      earliest: string;
      latest: string;
    };
    filesProcessed: string[];
    timestamp: string;
    source: string;
  };
  songs: CompleteSong[];
}

interface TopSong {
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
}

interface TopAlbum {
  duration_ms: number;
  count: number;
  albumId: string;
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
}

interface TopArtist {
  duration_ms: number;
  count: number;
  differents: number;
  artistId: string;
  primaryArtistId: string;
  total_count: number;
  total_duration_ms: number;
  artist: {
    name: string;
    genres: string[];
    images: Array<{
      height: number;
      url: string;
      width: number;
    }>;
  };
}

class HistoryToTopDataConverter {
  /**
   * Find the most recent merged streaming history file
   */
  private findLatestMergedHistoryFile(): string | null {
    const files = glob.sync('merged-streaming-history/merged-streaming-history-*.json');
    
    if (files.length === 0) {
      console.log('⚠️  No merged streaming history files found');
      return null;
    }
    
    // Sort by timestamp (newest first)
    files.sort((a, b) => {
      const timestampA = parseInt(a.match(/merged-streaming-history-(\d+)\.json/)?.[1] || '0');
      const timestampB = parseInt(b.match(/merged-streaming-history-(\d+)\.json/)?.[1] || '0');
      return timestampB - timestampA;
    });
    
    return files[0];
  }

  /**
   * Load merged streaming history data
   */
  private loadMergedHistory(filename: string): MergedStreamingHistory {
    try {
      const content = fs.readFileSync(filename, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load merged history file: ${error}`);
    }
  }

  /**
   * Convert songs to top-songs format
   */
  private convertToTopSongs(songs: CompleteSong[]): TopSong[] {
    return songs.map(song => ({
      duration_ms: song.duration_ms,
      count: song.playCount,
      songId: song.songId,
      song: {
        name: song.name,
        preview_url: song.preview_url,
        external_urls: song.external_urls
      },
      album: {
        name: song.album.name,
        images: song.album.images
      },
      artist: {
        name: song.artist.name,
        genres: song.artist.genres
      }
    }));
  }

  /**
   * Convert songs to top-albums format
   */
  private convertToTopAlbums(songs: CompleteSong[]): TopAlbum[] {
    const albumMap = new Map<string, TopAlbum>();

    songs.forEach(song => {
      const key = `${song.album.id}`;
      
      if (albumMap.has(key)) {
        const existing = albumMap.get(key)!;
        existing.count += song.playCount;
        existing.duration_ms += song.duration_ms;
        
        // Merge genres
        const mergedGenres = [...new Set([...existing.artist.genres, ...song.artist.genres])];
        existing.artist.genres = mergedGenres;
        
        // Keep album with more images (better quality)
        if (song.album.images.length > existing.album.images.length) {
          existing.album.images = song.album.images;
        }
      } else {
        albumMap.set(key, {
          duration_ms: song.duration_ms,
          count: song.playCount,
          albumId: song.album.id,
          album: {
            name: song.album.name,
            images: song.album.images
          },
          artist: {
            name: song.artist.name,
            genres: song.artist.genres
          }
        });
      }
    });

    return Array.from(albumMap.values());
  }

  /**
   * Convert songs to top-artists format
   */
  private convertToTopArtists(songs: CompleteSong[]): TopArtist[] {
    const artistMap = new Map<string, TopArtist>();

    songs.forEach(song => {
      const key = song.artist.name.toLowerCase();
      
      if (artistMap.has(key)) {
        const existing = artistMap.get(key)!;
        existing.count += song.playCount;
        existing.duration_ms += song.duration_ms;
        existing.differents += 1;
        existing.total_count += song.playCount;
        existing.total_duration_ms += song.duration_ms;
        
        // Merge genres
        const mergedGenres = [...new Set([...existing.artist.genres, ...song.artist.genres])];
        existing.artist.genres = mergedGenres;
        
        // Keep artist with more images (better quality)
        if (song.album.images.length > existing.artist.images.length) {
          existing.artist.images = song.album.images;
        }
      } else {
        artistMap.set(key, {
          duration_ms: song.duration_ms,
          count: song.playCount,
          differents: 1,
          artistId: song.songId, // Use songId as artistId for now
          primaryArtistId: song.songId,
          total_count: song.playCount,
          total_duration_ms: song.duration_ms,
          artist: {
            name: song.artist.name,
            genres: song.artist.genres,
            images: song.album.images // Use album images as artist images
          }
        });
      }
    });

    return Array.from(artistMap.values());
  }

  /**
   * Save top data files
   */
  private saveTopDataFiles(topSongs: TopSong[], topAlbums: TopAlbum[], topArtists: TopArtist[]): void {
    const timestamp = Date.now();
    
    // Save top-songs
    const songsFile = `top-songs-${timestamp}.json`;
    fs.writeFileSync(songsFile, JSON.stringify({ songs: topSongs }, null, 2));
    console.log(`💾 Saved top-songs data to: ${songsFile}`);
    
    // Save top-albums
    const albumsFile = `top-albums-${timestamp}.json`;
    fs.writeFileSync(albumsFile, JSON.stringify({ albums: topAlbums }, null, 2));
    console.log(`💾 Saved top-albums data to: ${albumsFile}`);
    
    // Save top-artists
    const artistsFile = `top-artists-${timestamp}.json`;
    fs.writeFileSync(artistsFile, JSON.stringify({ artists: topArtists }, null, 2));
    console.log(`💾 Saved top-artists data to: ${artistsFile}`);
  }

  /**
   * Main conversion function
   */
  async convertHistoryToTopData(): Promise<void> {
    try {
      console.log('🔄 Starting conversion from merged streaming history to top data...');
      
      // Find latest merged history file
      const historyFile = this.findLatestMergedHistoryFile();
      
      if (!historyFile) {
        console.log('⚠️  No merged streaming history files found');
        return;
      }
      
      console.log(`📁 Loading merged history from: ${historyFile}`);
      
      // Load data
      const historyData = this.loadMergedHistory(historyFile);
      
      console.log(`📊 Found ${historyData.songs.length} songs in merged history`);
      
      // Convert to different formats
      console.log('🔄 Converting to top-songs format...');
      const topSongs = this.convertToTopSongs(historyData.songs);
      
      console.log('🔄 Converting to top-albums format...');
      const topAlbums = this.convertToTopAlbums(historyData.songs);
      
      console.log('🔄 Converting to top-artists format...');
      const topArtists = this.convertToTopArtists(historyData.songs);
      
      // Save files
      this.saveTopDataFiles(topSongs, topAlbums, topArtists);
      
      console.log('🎉 Conversion completed successfully!');
      console.log(`📊 Summary:`);
      console.log(`- Songs: ${topSongs.length}`);
      console.log(`- Albums: ${topAlbums.length}`);
      console.log(`- Artists: ${topArtists.length}`);
      
    } catch (error) {
      console.error('💥 Conversion failed:', error);
      process.exit(1);
    }
  }
}

// Run the script if called directly
if (require.main === module) {
  const converter = new HistoryToTopDataConverter();
  converter.convertHistoryToTopData();
}

export { HistoryToTopDataConverter };
