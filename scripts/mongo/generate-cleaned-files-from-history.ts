import * as fs from 'fs';
import { glob } from 'glob';
import { SpotifyTokenManager } from '../spotify-token-manager';
import { uploadMultipleToVercelBlob, cleanupOldBlobFiles } from '../utils/vercel-blob-uploader';

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

interface CompleteListeningHistory {
  metadata: {
    totalSongs: number;
    totalListeningEvents: number;
    totalListeningTime: number;
    dateRange: {
      earliest: string;
      latest: string;
    };
    timestamp: string;
    source: string;
  };
  songs: CompleteSong[];
}

// Output types (matching existing format)
interface CleanedSong {
  rank: number;
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
}

interface CleanedAlbum {
  rank: number;
  duration_ms: number;
  count: number;
  differents: number;
  primaryAlbumId: string;
  total_count: number;
  total_duration_ms: number;
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
}

interface CleanedArtist {
  rank: number;
  duration_ms: number;
  count: number;
  differents: number;
  primaryArtistId: string;
  total_count: number;
  total_duration_ms: number;
  artist: {
    name: string;
    genres: string[];
    popularity: number;
    followers: {
      total: number;
    };
    images: Array<{
      height: number;
      url: string;
      width: number;
    }>;
    external_urls: Record<string, string>;
  };
  consolidated_count: number;
  original_artistIds: string[];
}

// Song within album (for detailed album view)
interface AlbumSong {
  songId: string;
  name: string;
  duration_ms: number;
  track_number: number;
  disc_number: number;
  explicit: boolean;
  preview_url: string | null;
  external_urls: Record<string, string>;
  play_count: number;
  total_listening_time_ms: number;
  artists: string[];
}

interface AlbumWithSongs extends CleanedAlbum {
  total_songs: number;
  played_songs: number;
  unplayed_songs: number;
  songs: AlbumSong[];
}

// Spotify API interfaces
interface SpotifyTrack {
  id: string;
  name: string;
  track_number: number;
  disc_number: number;
  explicit: boolean;
  album: {
    id: string;
    name: string;
    album_type: string;
    images: Array<{
      height: number;
      url: string;
      width: number;
    }>;
    release_date: string;
    release_date_precision: string;
    artists: Array<{
      id: string;
      name: string;
    }>;
    external_urls: {
      spotify: string;
    };
  };
  artists: Array<{
    id: string;
    name: string;
  }>;
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
}

interface SpotifyTracksResponse {
  tracks: SpotifyTrack[];
}

interface SpotifyAlbum {
  id: string;
  name: string;
  album_type: string;
  artists: Array<{
    id: string;
    name: string;
  }>;
  release_date: string;
  release_date_precision: string;
  popularity: number;
  images: Array<{
    height: number;
    url: string;
    width: number;
  }>;
  external_urls: {
    spotify: string;
  };
  genres: string[];
}

interface SpotifyAlbumsResponse {
  albums: SpotifyAlbum[];
}

interface SpotifyArtist {
  id: string;
  name: string;
  popularity: number;
  followers: {
    total: number;
  };
  images: Array<{
    height: number;
    url: string;
    width: number;
  }>;
  external_urls: {
    spotify: string;
  };
  genres: string[];
}

interface SpotifyArtistsResponse {
  artists: SpotifyArtist[];
}

interface ConsolidationRule {
  artistName: string;
  baseAlbumName: string;
  variations: string[];
}

interface ConsolidationRules {
  rules: ConsolidationRule[];
}

class CleanedFilesGenerator {
  private tokenManager: SpotifyTokenManager | null = null;
  private consolidationRules: Map<string, string> | null = null; // Map<"artist|album", "baseAlbumName">
  private consolidationRulesData: ConsolidationRules | null = null; // Store full rules data for casing lookup
  /**
   * Find the most recent complete listening history file
   */
  private findLatestCompleteHistoryFile(): string | null {
    // First check for merged streaming history files (new format)
    let files = glob.sync('data/merged-streaming-history/merged-streaming-history-*.json');
    
    if (files.length === 0) {
      // Fallback to old complete listening history format
      files = glob.sync('data/complete-listening-history/complete-listening-history-*.json');
    }
    
    if (files.length === 0) {
      console.log('⚠️  No complete listening history files found');
      return null;
    }
    
    // Sort by timestamp (newest first)
    files.sort((a, b) => {
      const timestampA = parseInt(a.match(/(?:merged-streaming-history-|complete-listening-history-)(\d+)\.json/)?.[1] || '0');
      const timestampB = parseInt(b.match(/(?:merged-streaming-history-|complete-listening-history-)(\d+)\.json/)?.[1] || '0');
      return timestampB - timestampA;
    });
    
    return files[0];
  }

  /**
   * Load complete listening history (handles both formats)
   */
  private loadCompleteHistory(filename: string): CompleteListeningHistory {
    try {
      const content = fs.readFileSync(filename, 'utf8');
      const data = JSON.parse(content);
      
      // Check if it's the new merged streaming history format
      if (data.metadata && data.metadata.totalPlayEvents !== undefined) {
        // Convert MergedStreamingHistory to CompleteListeningHistory format
        return {
          metadata: {
            totalSongs: data.metadata.totalSongs,
            totalListeningEvents: data.metadata.totalPlayEvents,
            totalListeningTime: data.songs.reduce((sum: number, song: CompleteSong) => sum + song.totalListeningTime, 0),
            dateRange: data.metadata.dateRange,
            timestamp: data.metadata.timestamp,
            source: data.metadata.source
          },
          songs: data.songs
        };
      }
      
      // If it's already CompleteListeningHistory format but missing totalListeningEvents, calculate it
      if (data.metadata && data.metadata.totalListeningEvents === undefined && data.songs) {
        const totalListeningEvents = data.songs.reduce((sum: number, song: CompleteSong) => sum + (song.listeningEvents?.length || 0), 0);
        return {
          ...data,
          metadata: {
            ...data.metadata,
            totalListeningEvents
          }
        };
      }
      
      // Return as-is if it's already CompleteListeningHistory format
      return data;
    } catch (error) {
      throw new Error(`Failed to load complete history file: ${error}`);
    }
  }

  /**
   * Consolidate songs by name and artist (same logic as consolidate-all-mongodb-data.ts)
   */
  private consolidateSongs(songs: CleanedSong[]): CleanedSong[] {
    console.log('🔄 Consolidating songs...');
    
    const consolidationMap = new Map<string, CleanedSong>();
    let duplicatesRemoved = 0;
    
    songs.forEach(song => {
      const key = `${song.song.name.toLowerCase().trim()}|${song.artist.name.toLowerCase().trim()}`;
      
      if (consolidationMap.has(key)) {
        const existing = consolidationMap.get(key)!;
        
        existing.count += song.count;
        existing.consolidated_count += song.count;
        // Keep the original track duration (don't sum durations)
        // existing.duration_ms remains unchanged
        existing.original_songIds.push(song.songId);
        
        duplicatesRemoved++;
      } else {
        consolidationMap.set(key, {
          ...song,
          consolidated_count: song.count
        });
      }
    });
    
    const consolidatedSongs = Array.from(consolidationMap.values())
      .sort((a, b) => b.count - a.count);
    
    console.log(`📊 Songs: ${songs.length} → ${consolidatedSongs.length} (${duplicatesRemoved} duplicates removed)`);
    return consolidatedSongs;
  }

  /**
   * Load consolidation rules from JSON file
   */
  private loadConsolidationRules(): Map<string, string> {
    if (this.consolidationRules) {
      return this.consolidationRules;
    }

    const rulesMap = new Map<string, string>();
    
    try {
      if (fs.existsSync('album-consolidation-rules.json')) {
        const rulesData = JSON.parse(fs.readFileSync('album-consolidation-rules.json', 'utf8')) as ConsolidationRules;
        this.consolidationRulesData = rulesData; // Store for later casing lookup
        
        rulesData.rules.forEach(rule => {
          const artistKey = rule.artistName.toLowerCase().trim();
          const baseAlbumName = rule.baseAlbumName.toLowerCase().trim();
          
          // Map each variation to the base album name
          rule.variations.forEach(variation => {
            const variationKey = variation.toLowerCase().trim();
            const mapKey = `${artistKey}|${variationKey}`;
            rulesMap.set(mapKey, baseAlbumName);
          });
          
          // Also map the base album name to itself
          const baseKey = `${artistKey}|${baseAlbumName}`;
          rulesMap.set(baseKey, baseAlbumName);
        });
        
        console.log(`📋 Loaded ${rulesData.rules.length} consolidation rules`);
      } else {
        console.log('ℹ️  No consolidation rules file found (album-consolidation-rules.json)');
      }
    } catch (error) {
      console.error('⚠️  Failed to load consolidation rules:', error);
    }
    
    this.consolidationRules = rulesMap;
    return rulesMap;
  }

  /**
   * Normalize album name using consolidation rules (returns lowercase for comparison only)
   * This is used to create consolidation keys - it does NOT modify the actual album name.
   * The actual album name casing is preserved unless a rule exists (see getBaseAlbumName).
   */
  private normalizeAlbumName(albumName: string, artistName: string): string {
    const rules = this.loadConsolidationRules();
    const key = `${artistName.toLowerCase().trim()}|${albumName.toLowerCase().trim()}`;
    const normalized = rules.get(key);
    
    if (normalized) {
      return normalized; // Return lowercase normalized name for comparison key only
    }
    
    return albumName.toLowerCase().trim(); // Return lowercase for comparison key only
  }

  /**
   * Get the base album name with correct casing from consolidation rules
   */
  private getBaseAlbumName(albumName: string, artistName: string): string | null {
    if (!this.consolidationRulesData) {
      return null;
    }
    
    const normalized = this.normalizeAlbumName(albumName, artistName);
    const rule = this.consolidationRulesData.rules.find(r => 
      r.artistName.toLowerCase().trim() === artistName.toLowerCase().trim() &&
      r.baseAlbumName.toLowerCase().trim() === normalized
    );
    
    return rule ? rule.baseAlbumName : null;
  }

  /**
   * Consolidate albums by name and first artist, using consolidation rules
   */
  private consolidateAlbums(albums: CleanedAlbum[]): CleanedAlbum[] {
    console.log('🔄 Consolidating albums...');
    
    const consolidationMap = new Map<string, CleanedAlbum>();
    let duplicatesRemoved = 0;
    
    albums.forEach(album => {
      const firstArtist = album.album.artists[0] || 'Unknown Artist';
      // Normalize album name using consolidation rules
      const normalizedAlbumName = this.normalizeAlbumName(album.album.name, firstArtist);
      const key = `${normalizedAlbumName}|${firstArtist.toLowerCase().trim()}`;
      
      if (consolidationMap.has(key)) {
        const existing = consolidationMap.get(key)!;
        
        existing.count += album.count;
        existing.total_count += album.total_count;
        existing.duration_ms += album.duration_ms;
        existing.total_duration_ms += album.total_duration_ms;
        existing.differents += album.differents;
        existing.consolidated_count += album.count;
        existing.original_albumIds.push(album.primaryAlbumId);
        
        // Update album name to use the normalized/base name if it's better
        const normalizedBaseName = this.normalizeAlbumName(album.album.name, firstArtist);
        if (normalizedBaseName !== album.album.name.toLowerCase().trim() && 
            normalizedBaseName === existing.album.name.toLowerCase().trim()) {
          // Keep existing (already normalized)
        } else if (normalizedBaseName !== existing.album.name.toLowerCase().trim()) {
          // Use the one with more plays or better metadata
          if (album.count > existing.count || 
              (album.album.images && album.album.images.length > 0 && (!existing.album.images || existing.album.images.length === 0))) {
            existing.album.name = album.album.name;
            existing.album.images = album.album.images.length > 0 ? album.album.images : existing.album.images;
            existing.album.external_urls = Object.keys(album.album.external_urls).length > 0 ? album.album.external_urls : existing.album.external_urls;
          }
        }
        
        duplicatesRemoved++;
      } else {
        // Create new entry - preserve original album name casing unless a rule exists
        const finalAlbum = {
          ...album,
          consolidated_count: album.count
        };
        
        // Only update album name if a consolidation rule exists (preserves original casing otherwise)
        const baseName = this.getBaseAlbumName(album.album.name, firstArtist);
        if (baseName) {
          finalAlbum.album.name = baseName; // Use rule's base name with correct casing
        }
        // If no rule exists, finalAlbum.album.name keeps its original casing from ...album
        
        consolidationMap.set(key, finalAlbum);
      }
    });
    
    const consolidatedAlbums = Array.from(consolidationMap.values())
      .sort((a, b) => b.count - a.count);
    
    console.log(`📊 Albums: ${albums.length} → ${consolidatedAlbums.length} (${duplicatesRemoved} duplicates removed)`);
    return consolidatedAlbums;
  }

  /**
   * Consolidate artists by name
   */
  private consolidateArtists(artists: CleanedArtist[]): CleanedArtist[] {
    console.log('🔄 Consolidating artists...');
    
    const consolidationMap = new Map<string, CleanedArtist>();
    let duplicatesRemoved = 0;
    
    artists.forEach(artist => {
      const key = artist.artist.name.toLowerCase().trim();
      
      if (consolidationMap.has(key)) {
        const existing = consolidationMap.get(key)!;
        
        existing.count += artist.count;
        existing.total_count += artist.total_count;
        existing.duration_ms += artist.duration_ms;
        existing.total_duration_ms += artist.total_duration_ms;
        existing.differents += artist.differents;
        existing.consolidated_count += artist.count;
        existing.original_artistIds.push(artist.primaryArtistId);
        
        duplicatesRemoved++;
      } else {
        consolidationMap.set(key, {
          ...artist,
          consolidated_count: artist.count
        });
      }
    });
    
    const consolidatedArtists = Array.from(consolidationMap.values())
      .sort((a, b) => b.count - a.count);
    
    console.log(`📊 Artists: ${artists.length} → ${consolidatedArtists.length} (${duplicatesRemoved} duplicates removed)`);
    return consolidatedArtists;
  }

  /**
   * Generate cleaned songs from complete history
   */
  private generateCleanedSongs(history: CompleteListeningHistory): { songs: CleanedSong[], originalCount: number, consolidatedCount: number } {
    console.log('🎵 Generating cleaned songs...');

    // Convert complete songs to cleaned format
    const songs: CleanedSong[] = history.songs.map(song => ({
      rank: 0, // Temporary rank, will be updated after sorting
      duration_ms: song.duration_ms, // Actual track duration
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
      },
      consolidated_count: song.playCount,
      original_songIds: [song.songId]
    }));

    // Sort by play count (descending) before consolidation
    songs.sort((a, b) => b.count - a.count);
    
    // Consolidate songs
    const consolidatedSongs = this.consolidateSongs(songs);
    
    // Take top 500 and add rank
    const topSongs = consolidatedSongs.slice(0, 500).map((song, index) => ({
      ...song,
      rank: index + 1
    }));
    
    return {
      songs: topSongs,
      originalCount: songs.length,
      consolidatedCount: consolidatedSongs.length
    };
  }

  /**
   * Generate cleaned albums from complete history
   */
  private generateCleanedAlbums(history: CompleteListeningHistory): { albums: CleanedAlbum[], originalCount: number, consolidatedCount: number } {
    console.log('💿 Generating cleaned albums...');

    // Group songs by album
    const albumMap = new Map<string, {
      songs: CompleteSong[];
      totalPlayCount: number;
      totalListeningTime: number;
      differentSongs: Set<string>;
    }>();

    history.songs.forEach(song => {
      // Use album name + first artist as key since many songs have empty album IDs
      const albumKey = `${song.album.name}|${song.artists[0] || 'Unknown Artist'}`;
      
      if (!albumMap.has(albumKey)) {
        albumMap.set(albumKey, {
          songs: [],
          totalPlayCount: 0,
          totalListeningTime: 0,
          differentSongs: new Set()
        });
      }
      
      const albumData = albumMap.get(albumKey)!;
      albumData.songs.push(song);
      albumData.totalPlayCount += song.playCount;
      albumData.totalListeningTime += song.totalListeningTime;
      albumData.differentSongs.add(song.songId);
    });

    // Convert to cleaned album format
    const albums: CleanedAlbum[] = Array.from(albumMap.entries()).map(([albumKey, data]) => {
      const firstSong = data.songs[0];
      
      // Always use first song's songId (not album ID) because Get Track endpoint requires song IDs
      // We'll use this song ID to fetch track info, which includes the album ID
      const primaryAlbumId = firstSong.songId;
      
      return {
        rank: 0, // Temporary rank, will be updated after sorting
        duration_ms: data.songs.reduce((sum, song) => sum + song.duration_ms, 0),
        count: data.totalPlayCount,
        differents: data.differentSongs.size,
        primaryAlbumId: primaryAlbumId,
        total_count: data.totalPlayCount,
        total_duration_ms: data.totalListeningTime,
        album: {
          name: firstSong.album.name,
          album_type: 'album', // We don't have this info in complete history
          artists: firstSong.artists,
          release_date: '', // We don't have this info
          release_date_precision: 'day',
          popularity: 0, // We don't have this info
          images: firstSong.album.images,
          external_urls: {}, // We don't have this info
          genres: firstSong.artist.genres
        },
        consolidated_count: data.totalPlayCount,
        original_albumIds: data.songs.map(song => song.album.id).filter(id => id !== '') // Collect all non-empty album IDs
      };
    });

    // Sort by play count (descending) before consolidation
    albums.sort((a, b) => b.count - a.count);
    
    // Consolidate albums
    const consolidatedAlbums = this.consolidateAlbums(albums);
    
    // Take top 500 and add rank
    const topAlbums = consolidatedAlbums.slice(0, 500).map((album, index) => ({
      ...album,
      rank: index + 1
    }));
    
    return {
      albums: topAlbums,
      originalCount: albums.length,
      consolidatedCount: consolidatedAlbums.length
    };
  }

  /**
   * Generate cleaned artists from complete history
   */
  private generateCleanedArtists(history: CompleteListeningHistory): { artists: CleanedArtist[], originalCount: number, consolidatedCount: number } {
    console.log('👤 Generating cleaned artists...');

    // Group songs by artist
    const artistMap = new Map<string, {
      songs: CompleteSong[];
      totalPlayCount: number;
      totalListeningTime: number;
      differentSongs: Set<string>;
    }>();

    history.songs.forEach(song => {
      const artistName = song.artist.name;
      
      if (!artistMap.has(artistName)) {
        artistMap.set(artistName, {
          songs: [],
          totalPlayCount: 0,
          totalListeningTime: 0,
          differentSongs: new Set()
        });
      }
      
      const artistData = artistMap.get(artistName)!;
      artistData.songs.push(song);
      artistData.totalPlayCount += song.playCount;
      artistData.totalListeningTime += song.totalListeningTime;
      artistData.differentSongs.add(song.songId);
    });

    // Convert to cleaned artist format
    const artists: CleanedArtist[] = Array.from(artistMap.entries()).map(([artistName, data]) => {
      const firstSong = data.songs[0];
      
      return {
        rank: 0, // Temporary rank, will be updated after sorting
        duration_ms: data.songs.reduce((sum, song) => sum + song.duration_ms, 0),
        count: data.totalPlayCount,
        differents: data.differentSongs.size,
        primaryArtistId: firstSong.songId, // Use first song ID as artist ID
        total_count: data.totalPlayCount,
        total_duration_ms: data.totalListeningTime,
        artist: {
          name: artistName,
          genres: firstSong.artist.genres,
          popularity: 0, // We don't have this info
          followers: {
            total: 0 // We don't have this info
          },
          images: [], // We don't have this info
          external_urls: {} // We don't have this info
        },
        consolidated_count: data.totalPlayCount,
        original_artistIds: [firstSong.songId]
      };
    });

    // Sort by play count (descending) before consolidation
    artists.sort((a, b) => b.count - a.count);
    
    // Consolidate artists
    const consolidatedArtists = this.consolidateArtists(artists);
    
    // Take top 500 and add rank
    const topArtists = consolidatedArtists.slice(0, 500).map((artist, index) => ({
      ...artist,
      rank: index + 1
    }));
    
    return {
      artists: topArtists,
      originalCount: artists.length,
      consolidatedCount: consolidatedArtists.length
    };
  }

  /**
   * Consolidate albums with songs, using consolidation rules
   */
  private consolidateAlbumsWithSongs(albums: AlbumWithSongs[]): AlbumWithSongs[] {
    console.log('🔄 Consolidating albums with songs...');
    
    const consolidationMap = new Map<string, AlbumWithSongs>();
    let duplicatesRemoved = 0;
    
    albums.forEach(album => {
      const firstArtist = album.album.artists[0] || 'Unknown Artist';
      // Normalize album name using consolidation rules
      const normalizedAlbumName = this.normalizeAlbumName(album.album.name, firstArtist);
      const key = `${normalizedAlbumName}|${firstArtist.toLowerCase().trim()}`;
      
      if (consolidationMap.has(key)) {
        const existing = consolidationMap.get(key)!;
        
        // Merge album statistics
        existing.count += album.count;
        existing.total_duration_ms += album.total_duration_ms;
        existing.consolidated_count += album.consolidated_count;
        existing.original_albumIds.push(...album.original_albumIds);
        
        // Merge songs (consolidate by song name)
        const songMap = new Map<string, AlbumSong>();
        
        // Add existing songs
        existing.songs.forEach(song => {
          const songKey = `${song.name.toLowerCase().trim()}|${song.artists.join(', ').toLowerCase()}`;
          songMap.set(songKey, song);
        });
        
        // Add new songs
        album.songs.forEach(song => {
          const songKey = `${song.name.toLowerCase().trim()}|${song.artists.join(', ').toLowerCase()}`;
          
          if (songMap.has(songKey)) {
            const existingSong = songMap.get(songKey)!;
            existingSong.play_count += song.play_count;
            existingSong.total_listening_time_ms += song.total_listening_time_ms;
          } else {
            songMap.set(songKey, song);
          }
        });
        
        existing.songs = Array.from(songMap.values()).sort((a, b) => b.play_count - a.play_count);
        
        // Recalculate song counts after merging
        existing.total_songs = existing.songs.length;
        existing.played_songs = existing.songs.filter(song => song.play_count > 0).length;
        existing.unplayed_songs = existing.songs.filter(song => song.play_count === 0).length;
        
        // Update album name to use normalized/base name if better
        const normalizedBaseName = this.normalizeAlbumName(album.album.name, firstArtist);
        if (normalizedBaseName !== album.album.name.toLowerCase().trim() && 
            normalizedBaseName === existing.album.name.toLowerCase().trim()) {
          // Keep existing (already normalized)
        } else if (normalizedBaseName !== existing.album.name.toLowerCase().trim()) {
          // Use the one with more plays or better metadata
          if (album.count > existing.count || 
              (album.album.images && album.album.images.length > 0 && (!existing.album.images || existing.album.images.length === 0))) {
            existing.album.name = album.album.name;
            existing.album.images = album.album.images.length > 0 ? album.album.images : existing.album.images;
            existing.album.external_urls = Object.keys(album.album.external_urls).length > 0 ? album.album.external_urls : existing.album.external_urls;
          }
        }
        
        duplicatesRemoved++;
      } else {
        // Create new entry - preserve original album name casing unless a rule exists
        const finalAlbum = { ...album };
        
        // Only update album name if a consolidation rule exists (preserves original casing otherwise)
        const baseName = this.getBaseAlbumName(album.album.name, firstArtist);
        if (baseName) {
          finalAlbum.album.name = baseName; // Use rule's base name with correct casing
        }
        // If no rule exists, finalAlbum.album.name keeps its original casing from ...album
        
        // Sort songs by play count
        finalAlbum.songs = finalAlbum.songs.sort((a, b) => b.play_count - a.play_count);
        consolidationMap.set(key, finalAlbum);
      }
    });
    
    const consolidatedAlbums = Array.from(consolidationMap.values())
      .sort((a, b) => b.count - a.count);
    
    console.log(`📊 Albums with songs: ${albums.length} → ${consolidatedAlbums.length} (${duplicatesRemoved} duplicates removed)`);
    return consolidatedAlbums;
  }

  /**
   * Generate albums with songs from complete history
   */
  private generateAlbumsWithSongs(history: CompleteListeningHistory): { albums: AlbumWithSongs[], originalCount: number } {
    console.log('💿🎵 Generating albums with songs...');

    // Group songs by album - use a more reliable key
    // Group by album name + the song's actual artist (not just first artist in the group)
    const albumMap = new Map<string, CompleteSong[]>();
    history.songs.forEach(song => {
      // Skip songs with empty album names - they can't be reliably grouped
      if (!song.album.name || song.album.name.trim() === '') {
        return;
      }
      
      // Use album name + the song's actual artist as key
      // This ensures songs are grouped by what they actually are, not by what the first song says
      const albumName = song.album.name.trim();
      const songArtist = (song.artists[0] || song.artist.name || 'Unknown Artist').trim();
      
      // Create a normalized key using the song's own artist
      const albumKey = `${albumName.toLowerCase()}|${songArtist.toLowerCase()}`;
      
      if (!albumMap.has(albumKey)) {
        albumMap.set(albumKey, []);
      }
      albumMap.get(albumKey)!.push(song);
    });

    // Convert to albums with songs format
    const albumsWithSongs: AlbumWithSongs[] = Array.from(albumMap.entries()).map(([albumKey, songs]) => {
      // Validate that all songs in this group actually belong to the same album/artist
      // Find the most common artist among the songs
      const artistCounts = new Map<string, number>();
      songs.forEach(song => {
        const artist = (song.artists[0] || song.artist.name || '').trim();
        if (artist) {
          artistCounts.set(artist.toLowerCase(), (artistCounts.get(artist.toLowerCase()) || 0) + 1);
        }
      });
      
      // Get the most common artist
      let mostCommonArtist = '';
      let maxCount = 0;
      artistCounts.forEach((count, artist) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonArtist = artist;
        }
      });
      
      // Find the first song that matches the most common artist
      const representativeSong = songs.find(song => 
        (song.artists[0] || song.artist.name || '').toLowerCase().trim() === mostCommonArtist
      ) || songs[0];
      
      // Filter songs to only include those that match the representative artist
      // This prevents songs from different artists being grouped together
      const matchingSongs = songs.filter(song => {
        const songArtist = (song.artists[0] || song.artist.name || '').toLowerCase().trim();
        return songArtist === mostCommonArtist || songArtist === '';
      });
      
      // Use the filtered songs
      const validSongs = matchingSongs.length > 0 ? matchingSongs : songs;
      const firstSong = representativeSong;
      
      const totalPlayCount = validSongs.reduce((sum, song) => sum + song.playCount, 0);
      const totalListeningTime = validSongs.reduce((sum, song) => sum + song.totalListeningTime, 0);
      const playedSongs = validSongs.filter(song => song.playCount > 0).length;

      // Convert songs to album song format
      const albumSongs: AlbumSong[] = validSongs.map(song => ({
        songId: song.songId,
        name: song.name,
        duration_ms: song.duration_ms,
        track_number: 1, // We don't have this info
        disc_number: 1, // We don't have this info
        explicit: false, // We don't have this info
        preview_url: song.preview_url,
        external_urls: song.external_urls,
        play_count: song.playCount,
        total_listening_time_ms: song.totalListeningTime,
        artists: song.artists
      }));

      // Determine the album artists from the songs
      const albumArtists = validSongs
        .map(s => s.artists[0] || s.artist.name)
        .filter((artist, index, arr) => arr.indexOf(artist) === index && artist)
        .slice(0, 1); // Take the first unique artist

      // Find the most common album name among songs that match the most common artist
      // This helps fix cases where the source data has incorrect album names
      const albumNameCounts = new Map<string, number>();
      validSongs.forEach(song => {
        const albumName = (song.album.name || '').trim();
        if (albumName) {
          albumNameCounts.set(albumName.toLowerCase(), (albumNameCounts.get(albumName.toLowerCase()) || 0) + 1);
        }
      });
      
      // Get the most common album name
      let mostCommonAlbumName = '';
      let maxAlbumCount = 0;
      albumNameCounts.forEach((count, albumName) => {
        if (count > maxAlbumCount) {
          maxAlbumCount = count;
          mostCommonAlbumName = albumName;
        }
      });
      
      // If all songs have the same album name but it seems wrong (like a generic name),
      // and we have a consistent artist, try to infer a better album name
      // For now, we'll use the most common album name, but if it's suspiciously generic
      // and all songs are by the same artist, we might want to use a placeholder
      // However, since we can't determine the actual album name from the data,
      // we'll use the most common one but ensure the artist is correct
      
      // Find a representative song with the most common album name
      const representativeSongForAlbum = validSongs.find(song => 
        (song.album.name || '').toLowerCase().trim() === mostCommonAlbumName
      ) || representativeSong;
      
      // Use the most common album name, preserving the original casing from a song that has it
      const finalAlbumName = mostCommonAlbumName 
        ? validSongs.find(s => (s.album.name || '').toLowerCase().trim() === mostCommonAlbumName)?.album.name || representativeSongForAlbum.album.name
        : representativeSongForAlbum.album.name;

      return {
        rank: 0, // Temporary rank, will be updated after sorting
        duration_ms: totalListeningTime,
        count: totalPlayCount,
        differents: validSongs.length,
        // Use song ID (not album ID) because enrichment needs song ID to fetch track data and get album ID
        primaryAlbumId: representativeSongForAlbum.songId || validSongs[0]?.songId || '',
        total_count: totalPlayCount,
        total_duration_ms: totalListeningTime,
        album: {
          name: finalAlbumName.trim(),
          album_type: 'album',
          artists: albumArtists.length > 0 ? albumArtists : [representativeSong.artists[0] || representativeSong.artist.name || 'Unknown Artist'],
          release_date: '',
          release_date_precision: 'day',
          popularity: 0,
          images: representativeSongForAlbum.album.images,
          external_urls: {},
          genres: representativeSong.artist.genres
        },
        consolidated_count: totalPlayCount,
        original_albumIds: validSongs.map(song => song.album.id).filter(id => id !== ''), // Collect all non-empty album IDs
        total_songs: validSongs.length,
        played_songs: playedSongs,
        unplayed_songs: validSongs.length - playedSongs,
        songs: albumSongs.sort((a, b) => b.play_count - a.play_count)
      };
    });

    // Sort by play count (descending) before consolidation
    albumsWithSongs.sort((a, b) => b.count - a.count);
    
    const originalCount = albumsWithSongs.length;
    const consolidatedAlbums = this.consolidateAlbumsWithSongs(albumsWithSongs);
    
    // Take top 100 and add rank
    const rankedAlbums = consolidatedAlbums.slice(0, 100).map((album, index) => ({
      ...album,
      rank: index + 1
    }));
    
    return { albums: rankedAlbums, originalCount };
  }

  /**
   * Initialize Spotify token manager
   */
  private async initializeSpotifyToken(): Promise<void> {
    if (!this.tokenManager) {
      try {
        this.tokenManager = new SpotifyTokenManager();
        const accessToken = await this.tokenManager.getValidAccessToken();
        const isValid = await this.tokenManager.testToken(accessToken);
        if (!isValid) {
          throw new Error('Invalid access token');
        }
        console.log('✅ Spotify token initialized');
      } catch (error) {
        console.log('ℹ️  Spotify tokens not available. Continuing without metadata enrichment.');
        console.log('   (This is optional - all cleaned files will still be generated successfully)');
        console.log('   To enable metadata enrichment, set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REFRESH_TOKEN.');
        this.tokenManager = null;
      }
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle rate limiting with retry logic
   */
  private async handleRateLimit(response: Response, retryCount: number = 0, maxRetries: number = 5): Promise<number> {
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.min(1000 * Math.pow(2, retryCount), 60000);
      
      if (retryCount >= maxRetries) {
        throw new Error(`Rate limited: Max retries (${maxRetries}) exceeded`);
      }

      console.log(`⏳ Rate limited (429). Waiting ${waitTime / 1000}s before retry ${retryCount + 1}/${maxRetries}...`);
      await this.sleep(waitTime);
      return retryCount + 1;
    }
    return retryCount;
  }

  /**
   * Fetch with retry logic for rate limiting
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retryCount: number = 0,
    maxRetries: number = 5
  ): Promise<Response> {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const newRetryCount = await this.handleRateLimit(response, retryCount, maxRetries);
      return this.fetchWithRetry(url, options, newRetryCount, maxRetries);
    }

    return response;
  }

  /**
   * Fetch track information from Spotify API (up to 50 tracks at a time)
   */
  private async fetchTracks(accessToken: string, trackIds: string[]): Promise<SpotifyTrack[]> {
    const tracks: SpotifyTrack[] = [];
    const batchSize = 50; // Spotify API limit for Get Several Tracks

    for (let i = 0; i < trackIds.length; i += batchSize) {
      const batch = trackIds.slice(i, i + batchSize);
      const idsParam = batch.join(',');

      try {
        const response = await this.fetchWithRetry(
          `https://api.spotify.com/v1/tracks?ids=${idsParam}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Failed to fetch tracks batch ${i / batchSize + 1}: ${response.status} ${errorText}`);
          continue;
        }

        const data = await response.json() as SpotifyTracksResponse;
        tracks.push(...data.tracks.filter(track => track !== null));

        // Rate limiting: wait a bit between batches
        if (i + batchSize < trackIds.length) {
          await this.sleep(100);
        }
      } catch (error) {
        console.error(`❌ Error fetching tracks batch ${i / batchSize + 1}:`, error);
      }
    }

    return tracks;
  }

  /**
   * Fetch album metadata from Spotify API (up to 20 albums at a time)
   */
  private async fetchAlbums(accessToken: string, albumIds: string[]): Promise<Map<string, SpotifyAlbum>> {
    const albumsMap = new Map<string, SpotifyAlbum>();
    const batchSize = 20; // Spotify API limit for Get Several Albums

    for (let i = 0; i < albumIds.length; i += batchSize) {
      const batch = albumIds.slice(i, i + batchSize);
      const idsParam = batch.join(',');

      try {
        const response = await this.fetchWithRetry(
          `https://api.spotify.com/v1/albums?ids=${idsParam}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Failed to fetch albums batch ${i / batchSize + 1}: ${response.status} ${errorText}`);
          continue;
        }

        const data = await response.json() as SpotifyAlbumsResponse;
        data.albums.forEach(album => {
          if (album !== null && album.id) {
            albumsMap.set(album.id, album);
          }
        });

        // Rate limiting: wait a bit between batches
        if (i + batchSize < albumIds.length) {
          await this.sleep(100);
        }
      } catch (error) {
        console.error(`❌ Error fetching albums batch ${i / batchSize + 1}:`, error);
      }
    }

    return albumsMap;
  }

  /**
   * Fetch artist metadata from Spotify API (up to 50 artists at a time)
   */
  private async fetchArtists(accessToken: string, artistIds: string[]): Promise<Map<string, SpotifyArtist>> {
    const artistsMap = new Map<string, SpotifyArtist>();
    const batchSize = 50; // Spotify API limit for Get Several Artists

    for (let i = 0; i < artistIds.length; i += batchSize) {
      const batch = artistIds.slice(i, i + batchSize);
      const idsParam = batch.join(',');

      try {
        const response = await this.fetchWithRetry(
          `https://api.spotify.com/v1/artists?ids=${idsParam}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Failed to fetch artists batch ${i / batchSize + 1}: ${response.status} ${errorText}`);
          continue;
        }

        const data = await response.json() as SpotifyArtistsResponse;
        data.artists.forEach(artist => {
          if (artist !== null && artist.id) {
            artistsMap.set(artist.id, artist);
          }
        });

        // Rate limiting: wait a bit between batches
        if (i + batchSize < artistIds.length) {
          await this.sleep(100);
        }
      } catch (error) {
        console.error(`❌ Error fetching artists batch ${i / batchSize + 1}:`, error);
      }
    }

    return artistsMap;
  }

  /**
   * Load existing cleaned files to preserve images
   */
  private loadExistingCleanedFiles(): {
    songs: Map<string, CleanedSong>;
    albums: Map<string, CleanedAlbum>;
    artists: Map<string, CleanedArtist>;
    albumsWithSongs: Map<string, AlbumWithSongs>;
  } {
    const result = {
      songs: new Map<string, CleanedSong>(),
      albums: new Map<string, CleanedAlbum>(),
      artists: new Map<string, CleanedArtist>(),
      albumsWithSongs: new Map<string, AlbumWithSongs>()
    };

    try {
      // Find latest existing files
      const songsFiles = glob.sync('data/cleaned-data/cleaned-songs-*.json');
      const albumsFiles = glob.sync('data/cleaned-data/cleaned-albums-*.json');
      const artistsFiles = glob.sync('data/cleaned-data/cleaned-artists-*.json');
      const albumsWithSongsFiles = glob.sync('data/cleaned-data/cleaned-albums-with-songs-*.json');

      // Load songs
      if (songsFiles.length > 0) {
        songsFiles.sort((a, b) => {
          const tsA = parseInt(a.match(/cleaned-songs-(\d+)\.json/)?.[1] || '0');
          const tsB = parseInt(b.match(/cleaned-songs-(\d+)\.json/)?.[1] || '0');
          return tsB - tsA;
        });
        const data = JSON.parse(fs.readFileSync(songsFiles[0], 'utf8'));
        if (data.songs) {
          data.songs.forEach((song: CleanedSong) => {
            result.songs.set(song.songId, song);
          });
        }
      }

      // Load albums
      if (albumsFiles.length > 0) {
        albumsFiles.sort((a, b) => {
          const tsA = parseInt(a.match(/cleaned-albums-(\d+)\.json/)?.[1] || '0');
          const tsB = parseInt(b.match(/cleaned-albums-(\d+)\.json/)?.[1] || '0');
          return tsB - tsA;
        });
        const data = JSON.parse(fs.readFileSync(albumsFiles[0], 'utf8'));
        if (data.albums) {
          data.albums.forEach((album: CleanedAlbum) => {
            // Use album name + artist as primary key (most reliable for matching)
            const nameKey = `${album.album.name.toLowerCase().trim()}|${(album.album.artists[0] || '').toLowerCase().trim()}`;
            result.albums.set(nameKey, album);
            // Also store by primaryAlbumId if available (for both song IDs and album IDs)
            if (album.primaryAlbumId) {
              result.albums.set(album.primaryAlbumId, album);
            }
          });
        }
      }

      // Load artists
      if (artistsFiles.length > 0) {
        artistsFiles.sort((a, b) => {
          const tsA = parseInt(a.match(/cleaned-artists-(\d+)\.json/)?.[1] || '0');
          const tsB = parseInt(b.match(/cleaned-artists-(\d+)\.json/)?.[1] || '0');
          return tsB - tsA;
        });
        const data = JSON.parse(fs.readFileSync(artistsFiles[0], 'utf8'));
        if (data.artists) {
          data.artists.forEach((artist: CleanedArtist) => {
            // Use artist name as primary key (most reliable for matching)
            const nameKey = artist.artist.name.toLowerCase().trim();
            result.artists.set(nameKey, artist);
            // Also store by primaryArtistId if available
            if (artist.primaryArtistId) {
              result.artists.set(artist.primaryArtistId, artist);
            }
          });
        }
      }

      // Load albums with songs
      if (albumsWithSongsFiles.length > 0) {
        albumsWithSongsFiles.sort((a, b) => {
          const tsA = parseInt(a.match(/cleaned-albums-with-songs-(\d+)\.json/)?.[1] || '0');
          const tsB = parseInt(b.match(/cleaned-albums-with-songs-(\d+)\.json/)?.[1] || '0');
          return tsB - tsA;
        });
        const data = JSON.parse(fs.readFileSync(albumsWithSongsFiles[0], 'utf8'));
        if (data.albums) {
          data.albums.forEach((album: AlbumWithSongs) => {
            // Use album name + artist as primary key (most reliable for matching)
            const nameKey = `${album.album.name.toLowerCase().trim()}|${(album.album.artists[0] || '').toLowerCase().trim()}`;
            result.albumsWithSongs.set(nameKey, album);
            // Also store by primaryAlbumId if available
            if (album.primaryAlbumId) {
              result.albumsWithSongs.set(album.primaryAlbumId, album);
            }
          });
        }
      }
    } catch (error) {
      console.log('⚠️  Could not load existing cleaned files for image preservation');
    }

    return result;
  }

  /**
   * Enrich cleaned songs with metadata from Spotify API
   */
  private async enrichSongsWithMetadata(songs: CleanedSong[], existingSongs: Map<string, CleanedSong>): Promise<CleanedSong[]> {
    if (!this.tokenManager) {
      console.log('ℹ️  Skipping song metadata enrichment (Spotify tokens not available)');
      return songs;
    }

    console.log('\n📥 Fetching song metadata from Spotify API...');
    
    // Find songs that need metadata (missing preview_url, external_urls, or images)
    const songsNeedingMetadata = songs.filter(song => {
      const existing = existingSongs.get(song.songId);
      const needsMetadata = !song.song.preview_url || !song.song.external_urls || Object.keys(song.song.external_urls).length === 0 || 
                           !song.album.images || song.album.images.length === 0;
      // If we have existing data with images, preserve it
      if (existing && existing.album.images && existing.album.images.length > 0) {
        song.album.images = existing.album.images;
      }
      return needsMetadata;
    });

    if (songsNeedingMetadata.length === 0) {
      console.log('✅ All songs already have metadata, skipping API calls');
      return songs;
    }

    const accessToken = await this.tokenManager.getValidAccessToken();
    const songIds = songsNeedingMetadata.map(song => song.songId).filter(id => id);
    const uniqueSongIds = Array.from(new Set(songIds));

    console.log(`   Fetching ${uniqueSongIds.length} unique tracks (${songs.length - uniqueSongIds.length} already have metadata)...`);
    const tracks = await this.fetchTracks(accessToken, uniqueSongIds);
    console.log(`✅ Fetched ${tracks.length} tracks`);

    const trackMap = new Map<string, SpotifyTrack>();
    tracks.forEach(track => trackMap.set(track.id, track));

    let enrichedCount = 0;
    songs.forEach(song => {
      const existing = existingSongs.get(song.songId);
      
      // Preserve existing images if available
      if (existing && existing.album.images && existing.album.images.length > 0) {
        song.album.images = existing.album.images;
      }

      const track = trackMap.get(song.songId);
      if (track) {
        song.song.preview_url = track.preview_url;
        song.song.external_urls = track.external_urls;
        // Only update images if we don't have them
        if (!song.album.images || song.album.images.length === 0) {
          song.album.images = track.album.images;
        }
        enrichedCount++;
      }
    });

    console.log(`✅ Enriched ${enrichedCount} songs with metadata`);
    return songs;
  }

  /**
   * Enrich cleaned albums with metadata from Spotify API
   */
  private async enrichAlbumsWithMetadata(albums: CleanedAlbum[], existingAlbums: Map<string, CleanedAlbum>): Promise<CleanedAlbum[]> {
    if (!this.tokenManager) {
      console.log('ℹ️  Skipping album metadata enrichment (Spotify tokens not available)');
      return albums;
    }

    console.log('\n📥 Fetching album metadata from Spotify API...');
    
    // Find albums that need metadata
    const albumsNeedingMetadata = albums.filter(album => {
      // Try to match by name + artist first (most reliable)
      const nameKey = `${album.album.name.toLowerCase().trim()}|${(album.album.artists[0] || '').toLowerCase().trim()}`;
      let existing = existingAlbums.get(nameKey);
      // Fallback to primaryAlbumId if name match didn't work
      if (!existing && album.primaryAlbumId) {
        existing = existingAlbums.get(album.primaryAlbumId);
      }
      // Preserve existing images if available
      if (existing && existing.album.images && existing.album.images.length > 0) {
        album.album.images = existing.album.images;
      }
      const needsMetadata = !album.album.images || album.album.images.length === 0 ||
                          !album.album.external_urls || Object.keys(album.album.external_urls).length === 0 ||
                          !album.album.release_date || album.album.release_date === '';
      return needsMetadata;
    });

    if (albumsNeedingMetadata.length === 0) {
      console.log('✅ All albums already have metadata, skipping API calls');
      return albums;
    }

    const accessToken = await this.tokenManager.getValidAccessToken();
    
    // Extract song IDs from primaryAlbumId (which are song IDs) for albums that need metadata
    const songIds = albumsNeedingMetadata.map(album => album.primaryAlbumId).filter(id => id);
    const uniqueSongIds = Array.from(new Set(songIds));

    console.log(`   Fetching ${uniqueSongIds.length} unique tracks to get album IDs (${albums.length - uniqueSongIds.length} already have metadata)...`);
    const tracks = await this.fetchTracks(accessToken, uniqueSongIds);
    console.log(`✅ Fetched ${tracks.length} tracks`);

    // Extract unique album IDs
    const albumIds = new Set<string>();
    const songIdToAlbumId = new Map<string, string>();
    tracks.forEach(track => {
      if (track.album && track.album.id) {
        albumIds.add(track.album.id);
        songIdToAlbumId.set(track.id, track.album.id);
      }
    });

    console.log(`   Found ${albumIds.size} unique album IDs`);
    
    // Fetch full album metadata
    const albumsMap = await this.fetchAlbums(accessToken, Array.from(albumIds));
    console.log(`✅ Fetched ${albumsMap.size} albums`);

    // Create track map for album images
    const trackMap = new Map<string, SpotifyTrack>();
    tracks.forEach(track => trackMap.set(track.id, track));

    let enrichedCount = 0;
    albums.forEach(album => {
      // Try to match by name + artist first (most reliable)
      const nameKey = `${album.album.name.toLowerCase().trim()}|${(album.album.artists[0] || '').toLowerCase().trim()}`;
      let existing = existingAlbums.get(nameKey);
      // Fallback to primaryAlbumId if name match didn't work
      if (!existing && album.primaryAlbumId) {
        existing = existingAlbums.get(album.primaryAlbumId);
      }
      
      // Preserve existing images if available
      if (existing && existing.album.images && existing.album.images.length > 0) {
        album.album.images = existing.album.images;
      }

      const track = trackMap.get(album.primaryAlbumId);
      const albumId = songIdToAlbumId.get(album.primaryAlbumId);
      const spotifyAlbum = albumId ? albumsMap.get(albumId) : null;

      if (track || spotifyAlbum) {
        // Update primaryAlbumId to actual album ID
        if (albumId) {
          album.primaryAlbumId = albumId;
        }

        // Update album metadata
        if (spotifyAlbum) {
          // Update album name and artists from Spotify API (this fixes incorrect source data)
          album.album.name = spotifyAlbum.name;
          album.album.artists = spotifyAlbum.artists.map(a => a.name);
          album.album.album_type = spotifyAlbum.album_type;
          album.album.release_date = spotifyAlbum.release_date;
          album.album.release_date_precision = spotifyAlbum.release_date_precision;
          album.album.popularity = spotifyAlbum.popularity;
          // Only update images if we don't have them
          if (!album.album.images || album.album.images.length === 0) {
            album.album.images = spotifyAlbum.images;
          }
          album.album.external_urls = spotifyAlbum.external_urls;
          album.album.genres = spotifyAlbum.genres;
        } else if (track) {
          // Fallback to track album data
          // Update album name and artists from track (this fixes incorrect source data)
          album.album.name = track.album.name;
          album.album.artists = track.album.artists.map(a => a.name);
          album.album.album_type = track.album.album_type;
          album.album.release_date = track.album.release_date;
          album.album.release_date_precision = track.album.release_date_precision;
          // Only update images if we don't have them
          if (!album.album.images || album.album.images.length === 0) {
            album.album.images = track.album.images;
          }
          album.album.external_urls = track.album.external_urls;
        }

        // Update original_albumIds
        if (albumId) {
          album.original_albumIds = [albumId];
        }

        enrichedCount++;
      }
    });

    console.log(`✅ Enriched ${enrichedCount} albums with metadata`);
    return albums;
  }

  /**
   * Enrich albums with songs with metadata from Spotify API
   */
  private async enrichAlbumsWithSongsMetadata(albums: AlbumWithSongs[], existingAlbums: Map<string, AlbumWithSongs>): Promise<AlbumWithSongs[]> {
    if (!this.tokenManager) {
      console.log('ℹ️  Skipping albums with songs metadata enrichment (Spotify tokens not available)');
      return albums;
    }

    // Create a map to track original song IDs (primaryAlbumId) to albums
    const songIdToAlbum = new Map<string, AlbumWithSongs>();
    albums.forEach(album => {
      songIdToAlbum.set(album.primaryAlbumId, album);
    });

    // Convert existing albums to CleanedAlbum format for matching
    const existingCleanedAlbums = new Map<string, CleanedAlbum>();
    existingAlbums.forEach((album, key) => {
      existingCleanedAlbums.set(key, {
        rank: album.rank,
        duration_ms: album.duration_ms,
        count: album.count,
        differents: album.differents,
        primaryAlbumId: album.primaryAlbumId,
        total_count: album.total_count,
        total_duration_ms: album.total_duration_ms,
        album: album.album,
        consolidated_count: album.consolidated_count,
        original_albumIds: album.original_albumIds
      });
    });

    // Use the same logic as regular albums
    const cleanedAlbums: CleanedAlbum[] = albums.map(album => ({
      rank: album.rank,
      duration_ms: album.duration_ms,
      count: album.count,
      differents: album.differents,
      primaryAlbumId: album.primaryAlbumId,
      total_count: album.total_count,
      total_duration_ms: album.total_duration_ms,
      album: album.album,
      consolidated_count: album.consolidated_count,
      original_albumIds: album.original_albumIds
    }));

    const enrichedAlbums = await this.enrichAlbumsWithMetadata(cleanedAlbums, existingCleanedAlbums);

    // Create a map from original song ID to enriched album (before primaryAlbumId changes)
    const enrichedMap = new Map<string, CleanedAlbum>();
    cleanedAlbums.forEach((original, index) => {
      const originalSongId = original.primaryAlbumId;
      if (enrichedAlbums[index]) {
        enrichedMap.set(originalSongId, enrichedAlbums[index]);
      }
    });

    // Map back to AlbumWithSongs format, preserving the songs and other properties
    const albumsWithEnrichedMetadata = albums.map(album => {
      const enriched = enrichedMap.get(album.primaryAlbumId);
      if (enriched) {
        return {
          ...album,
          primaryAlbumId: enriched.primaryAlbumId,
          album: enriched.album,
          original_albumIds: enriched.original_albumIds
        };
      }
      return album;
    });

    // Now enrich and consolidate songs within each album
    return await this.enrichAndConsolidateAlbumSongs(albumsWithEnrichedMetadata);
  }

  /**
   * Consolidate duplicate songs within an album
   */
  private consolidateSongsInAlbum(songs: AlbumSong[]): AlbumSong[] {
    const songMap = new Map<string, AlbumSong>();
    
    songs.forEach(song => {
      // Create a key from song name + artists
      const songKey = `${song.name.toLowerCase().trim()}|${song.artists.join(', ').toLowerCase().trim()}`;
      
      if (songMap.has(songKey)) {
        const existing = songMap.get(songKey)!;
        // Store original play count before merging
        const existingOriginalPlays = existing.play_count;
        // Merge play counts and listening times
        existing.play_count += song.play_count;
        existing.total_listening_time_ms += song.total_listening_time_ms;
        // Keep the songId with the highest original play count
        if (song.play_count > existingOriginalPlays) {
          existing.songId = song.songId;
          existing.external_urls = song.external_urls;
          existing.preview_url = song.preview_url;
        }
      } else {
        songMap.set(songKey, { ...song });
      }
    });
    
    return Array.from(songMap.values());
  }

  /**
   * Enrich songs within albums with track numbers and consolidate duplicates
   */
  private async enrichAndConsolidateAlbumSongs(albums: AlbumWithSongs[]): Promise<AlbumWithSongs[]> {
    if (!this.tokenManager) {
      // Still consolidate even without API access
      return albums.map(album => ({
        ...album,
        songs: this.consolidateSongsInAlbum(album.songs)
      }));
    }

    console.log('\n📥 Fetching track metadata for album songs...');
    
    // Collect all unique song IDs from all albums
    const allSongIds = new Set<string>();
    albums.forEach(album => {
      album.songs.forEach(song => {
        if (song.songId) {
          allSongIds.add(song.songId);
        }
      });
    });

    const accessToken = await this.tokenManager.getValidAccessToken();
    const uniqueSongIds = Array.from(allSongIds);
    
    console.log(`   Fetching ${uniqueSongIds.length} unique tracks for track numbers...`);
    
    // Fetch tracks in batches
    const trackMap = new Map<string, SpotifyTrack>();
    const batchSize = 50;
    for (let i = 0; i < uniqueSongIds.length; i += batchSize) {
      const batch = uniqueSongIds.slice(i, i + batchSize);
      const tracks = await this.fetchTracks(accessToken, batch);
      tracks.forEach(track => trackMap.set(track.id, track));
      
      // Rate limiting
      if (i + batchSize < uniqueSongIds.length) {
        await this.sleep(100);
      }
    }
    
    console.log(`✅ Fetched ${trackMap.size} tracks`);

    // Process each album
    return albums.map(album => {
      // First consolidate duplicate songs
      const consolidatedSongs = this.consolidateSongsInAlbum(album.songs);
      
      // Then enrich with track metadata
      const enrichedSongs = consolidatedSongs.map(song => {
        const track = trackMap.get(song.songId);
        if (track) {
          return {
            ...song,
            track_number: track.track_number,
            disc_number: track.disc_number,
            explicit: track.explicit,
            preview_url: track.preview_url || song.preview_url,
            external_urls: track.external_urls || song.external_urls
          };
        }
        return song;
      });
      
      // Sort by track number, then by disc number
      enrichedSongs.sort((a, b) => {
        if (a.disc_number !== b.disc_number) {
          return a.disc_number - b.disc_number;
        }
        if (a.track_number !== b.track_number) {
          return a.track_number - b.track_number;
        }
        // Fallback to play count if track numbers are the same
        return b.play_count - a.play_count;
      });

      // Recalculate song counts after consolidation
      const playedSongs = enrichedSongs.filter(song => song.play_count > 0).length;
      
      return {
        ...album,
        songs: enrichedSongs,
        total_songs: enrichedSongs.length,
        played_songs: playedSongs,
        unplayed_songs: enrichedSongs.length - playedSongs
      };
    });
  }

  /**
   * Enrich cleaned artists with metadata from Spotify API
   */
  private async enrichArtistsWithMetadata(artists: CleanedArtist[], existingArtists: Map<string, CleanedArtist>): Promise<CleanedArtist[]> {
    if (!this.tokenManager) {
      console.log('ℹ️  Skipping artist metadata enrichment (Spotify tokens not available)');
      return artists;
    }

    console.log('\n📥 Fetching artist metadata from Spotify API...');
    
    // Find artists that need metadata
    const artistsNeedingMetadata = artists.filter(artist => {
      // Try to match by name first (most reliable)
      const nameKey = artist.artist.name.toLowerCase().trim();
      let existing = existingArtists.get(nameKey);
      // Fallback to primaryArtistId if name match didn't work
      if (!existing && artist.primaryArtistId) {
        existing = existingArtists.get(artist.primaryArtistId);
      }
      // Preserve existing images if available
      if (existing && existing.artist.images && existing.artist.images.length > 0) {
        artist.artist.images = existing.artist.images;
      }
      const needsMetadata = !artist.artist.images || artist.artist.images.length === 0 ||
                           !artist.artist.external_urls || Object.keys(artist.artist.external_urls).length === 0 ||
                           artist.artist.popularity === 0;
      return needsMetadata;
    });

    if (artistsNeedingMetadata.length === 0) {
      console.log('✅ All artists already have metadata, skipping API calls');
      return artists;
    }

    const accessToken = await this.tokenManager.getValidAccessToken();
    
    // First, get artist IDs from tracks (since primaryArtistId is currently a song ID)
    const songIds = artistsNeedingMetadata.map(artist => artist.primaryArtistId).filter(id => id);
    const uniqueSongIds = Array.from(new Set(songIds));

    console.log(`   Fetching ${uniqueSongIds.length} unique tracks to get artist IDs (${artists.length - uniqueSongIds.length} already have metadata)...`);
    const tracks = await this.fetchTracks(accessToken, uniqueSongIds);
    console.log(`✅ Fetched ${tracks.length} tracks`);

    // Extract unique artist IDs from tracks
    const artistIds = new Set<string>();
    const songIdToArtistId = new Map<string, string>();
    tracks.forEach(track => {
      if (track.artists && track.artists.length > 0) {
        const artistId = track.artists[0].id; // Use first artist
        if (artistId) {
          artistIds.add(artistId);
          songIdToArtistId.set(track.id, artistId);
        }
      }
    });

    console.log(`   Found ${artistIds.size} unique artist IDs`);
    
    // Fetch full artist metadata
    const artistsMap = await this.fetchArtists(accessToken, Array.from(artistIds));
    console.log(`✅ Fetched ${artistsMap.size} artists`);

    let enrichedCount = 0;
    artists.forEach(artist => {
      // Try to match by name first (most reliable)
      const nameKey = artist.artist.name.toLowerCase().trim();
      let existing = existingArtists.get(nameKey);
      // Fallback to primaryArtistId if name match didn't work
      if (!existing && artist.primaryArtistId) {
        existing = existingArtists.get(artist.primaryArtistId);
      }
      
      // Preserve existing images if available
      if (existing && existing.artist.images && existing.artist.images.length > 0) {
        artist.artist.images = existing.artist.images;
      }

      const artistId = songIdToArtistId.get(artist.primaryArtistId);
      const spotifyArtist = artistId ? artistsMap.get(artistId) : null;

      if (spotifyArtist) {
        // Update primaryArtistId to actual artist ID
        artist.primaryArtistId = artistId!;
        artist.original_artistIds = [artistId!];

        // Update artist metadata
        artist.artist.popularity = spotifyArtist.popularity;
        artist.artist.followers = spotifyArtist.followers;
        // Only update images if we don't have them
        if (!artist.artist.images || artist.artist.images.length === 0) {
          artist.artist.images = spotifyArtist.images;
        }
        artist.artist.external_urls = spotifyArtist.external_urls;
        artist.artist.genres = spotifyArtist.genres;

        enrichedCount++;
      }
    });

    console.log(`✅ Enriched ${enrichedCount} artists with metadata`);
    return artists;
  }

  /**
   * Clean up old cleaned data files
   */
  private cleanupOldCleanedFiles(): void {
    try {
      const cleanedDataDir = 'data/cleaned-data';
      if (!fs.existsSync(cleanedDataDir)) {
        return;
      }

      const files = fs.readdirSync(cleanedDataDir);
      const patterns = [
        /^cleaned-songs-\d+\.json$/,
        /^cleaned-albums-\d+\.json$/,
        /^cleaned-artists-\d+\.json$/,
        /^cleaned-albums-with-songs-\d+\.json$/
      ];

      let deletedCount = 0;
      files.forEach(file => {
        if (patterns.some(pattern => pattern.test(file))) {
          const filePath = `${cleanedDataDir}/${file}`;
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      });

      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old cleaned data file(s)`);
      }
    } catch (error) {
      console.error('⚠️  Error cleaning up old files:', error);
    }
  }

  /**
   * Save all cleaned files and upload to Vercel Blob Storage
   */
  private async saveCleanedFiles(
    songsResult: { songs: CleanedSong[], originalCount: number, consolidatedCount: number },
    albumsResult: { albums: CleanedAlbum[], originalCount: number, consolidatedCount: number },
    artistsResult: { artists: CleanedArtist[], originalCount: number, consolidatedCount: number },
    albumsWithSongs: AlbumWithSongs[],
    originalAlbumsCount: number,
    history: CompleteListeningHistory
  ): Promise<void> {
    // Ensure directory exists
    if (!fs.existsSync('data/cleaned-data')) {
      fs.mkdirSync('data/cleaned-data', { recursive: true });
    }
    
    // Clean up old files before saving new ones
    this.cleanupOldCleanedFiles();
    
    const timestamp = Date.now();
    
    // Save songs
    const songsFile = `data/cleaned-data/cleaned-songs-${timestamp}.json`;
    fs.writeFileSync(songsFile, JSON.stringify({
      metadata: {
        originalTotalSongs: songsResult.originalCount,
        consolidatedTotalSongs: songsResult.consolidatedCount,
        duplicatesRemoved: songsResult.originalCount - songsResult.consolidatedCount,
        consolidationRate: Math.round(((songsResult.originalCount - songsResult.consolidatedCount) / songsResult.originalCount) * 100 * 100) / 100,
        timestamp: new Date().toISOString(),
        source: 'Merged Streaming History',
        totalListeningEvents: history.metadata.totalListeningEvents
      },
      songs: songsResult.songs.slice(0, 500) // Top 500
    }, null, 2));

    // Save albums
    const albumsFile = `data/cleaned-data/cleaned-albums-${timestamp}.json`;
    fs.writeFileSync(albumsFile, JSON.stringify({
      metadata: {
        originalTotalAlbums: albumsResult.originalCount,
        consolidatedTotalAlbums: albumsResult.consolidatedCount,
        duplicatesRemoved: albumsResult.originalCount - albumsResult.consolidatedCount,
        consolidationRate: Math.round(((albumsResult.originalCount - albumsResult.consolidatedCount) / albumsResult.originalCount) * 100 * 100) / 100,
        timestamp: new Date().toISOString(),
        source: 'Merged Streaming History',
        totalListeningEvents: history.metadata.totalListeningEvents
      },
      albums: albumsResult.albums.slice(0, 500) // Top 500
    }, null, 2));

    // Save artists
    const artistsFile = `data/cleaned-data/cleaned-artists-${timestamp}.json`;
    fs.writeFileSync(artistsFile, JSON.stringify({
      metadata: {
        originalTotalArtists: artistsResult.originalCount,
        consolidatedTotalArtists: artistsResult.consolidatedCount,
        duplicatesRemoved: artistsResult.originalCount - artistsResult.consolidatedCount,
        consolidationRate: Math.round(((artistsResult.originalCount - artistsResult.consolidatedCount) / artistsResult.originalCount) * 100 * 100) / 100,
        timestamp: new Date().toISOString(),
        source: 'Merged Streaming History',
        totalListeningEvents: history.metadata.totalListeningEvents
      },
      artists: artistsResult.artists.slice(0, 500) // Top 500
    }, null, 2));

    // Save albums with songs
    const albumsWithSongsFile = `data/cleaned-data/cleaned-albums-with-songs-${timestamp}.json`;
    fs.writeFileSync(albumsWithSongsFile, JSON.stringify({
      metadata: {
        originalTotalAlbums: originalAlbumsCount,
        consolidatedTotalAlbums: albumsWithSongs.length,
        duplicatesRemoved: originalAlbumsCount - albumsWithSongs.length,
        consolidationRate: Math.round(((originalAlbumsCount - albumsWithSongs.length) / originalAlbumsCount) * 100 * 100) / 100,
        timestamp: new Date().toISOString(),
        source: 'Merged Streaming History with Song Breakdown',
        totalListeningEvents: history.metadata.totalListeningEvents
      },
      albums: albumsWithSongs.slice(0, 100) // Top 100 albums with songs
    }, null, 2));

    console.log(`\n📁 All cleaned files saved:`);
    console.log(`- Songs: ${songsFile}`);
    console.log(`- Albums: ${albumsFile}`);
    console.log(`- Artists: ${artistsFile}`);
    console.log(`- Albums with Songs: ${albumsWithSongsFile}`);

    // Upload files to Vercel Blob Storage
    const shouldUpload = process.env.UPLOAD_TO_VERCEL_BLOB !== 'false';
    if (shouldUpload) {
      try {
        console.log('\n☁️  Uploading files to Vercel Blob Storage...');
        
        // Clean up old files first to ensure we only have 4 files
        await cleanupOldBlobFiles();
        
        // Upload with fixed filenames (no timestamp) to root of blob storage
        const blobUrls = await uploadMultipleToVercelBlob([
          {
            filePath: songsFile,
            blobPath: 'cleaned-songs.json'
          },
          {
            filePath: albumsFile,
            blobPath: 'cleaned-albums.json'
          },
          {
            filePath: artistsFile,
            blobPath: 'cleaned-artists.json'
          },
          {
            filePath: albumsWithSongsFile,
            blobPath: 'cleaned-albums-with-songs.json'
          }
        ]);

        console.log('\n✅ All files uploaded to Vercel Blob Storage:');
        blobUrls.forEach((url, index) => {
          const fileNames = ['Songs', 'Albums', 'Artists', 'Albums with Songs'];
          console.log(`- ${fileNames[index]}: ${url}`);
        });
      } catch (error) {
        console.error('\n⚠️  Failed to upload files to Vercel Blob Storage:', error);
        console.error('Files are still saved locally. Set UPLOAD_TO_VERCEL_BLOB=false to skip upload.');
      }
    } else {
      console.log('\n⏭️  Skipping Vercel Blob Storage upload (UPLOAD_TO_VERCEL_BLOB=false)');
    }
  }

  /**
   * Main function to generate all cleaned files
   */
  async generateCleanedFiles(): Promise<void> {
    try {
      console.log('🚀 Generating All Cleaned Files from Complete Listening History');
      console.log('================================================================');
      
      // Find latest complete history file
      const historyFile = this.findLatestCompleteHistoryFile();
      if (!historyFile) {
        console.log('⚠️  No complete listening history found');
        return;
      }
      
      console.log(`📁 Loading complete history from: ${historyFile}`);
      
      // Load complete history
      const history = this.loadCompleteHistory(historyFile);
      
      // Generate all cleaned files
      const songsResult = this.generateCleanedSongs(history);
      const albumsResult = this.generateCleanedAlbums(history);
      const artistsResult = this.generateCleanedArtists(history);
      const albumsWithSongsResult = this.generateAlbumsWithSongs(history);
      
      // Load existing cleaned files to preserve images
      const existingFiles = this.loadExistingCleanedFiles();
      
      // Initialize Spotify token for metadata fetching
      await this.initializeSpotifyToken();
      
      // Enrich with metadata from Spotify API
      if (this.tokenManager) {
        console.log('\n🎵 Enriching cleaned files with Spotify metadata...');
        songsResult.songs = await this.enrichSongsWithMetadata(songsResult.songs, existingFiles.songs);
        albumsResult.albums = await this.enrichAlbumsWithMetadata(albumsResult.albums, existingFiles.albums);
        artistsResult.artists = await this.enrichArtistsWithMetadata(artistsResult.artists, existingFiles.artists);
        albumsWithSongsResult.albums = await this.enrichAlbumsWithSongsMetadata(albumsWithSongsResult.albums, existingFiles.albumsWithSongs);
      }
      
      // Save all files and upload to Vercel Blob Storage
      await this.saveCleanedFiles(songsResult, albumsResult, artistsResult, albumsWithSongsResult.albums, albumsWithSongsResult.originalCount, history);
      
      console.log('');
      console.log('🎉 All cleaned files generated successfully!');
      console.log('');
      console.log('📊 Summary:');
      console.log(`- Total songs in history: ${history.metadata.totalSongs.toLocaleString()}`);
      console.log(`- Songs consolidated: ${songsResult.originalCount} → ${songsResult.consolidatedCount} (${songsResult.originalCount - songsResult.consolidatedCount} duplicates removed)`);
      console.log(`- Albums consolidated: ${albumsResult.originalCount} → ${albumsResult.consolidatedCount} (${albumsResult.originalCount - albumsResult.consolidatedCount} duplicates removed)`);
      console.log(`- Artists consolidated: ${artistsResult.originalCount} → ${artistsResult.consolidatedCount} (${artistsResult.originalCount - artistsResult.consolidatedCount} duplicates removed)`);
      console.log(`- Top 500 songs generated: ${Math.min(songsResult.songs.length, 500)}`);
      console.log(`- Top 500 albums generated: ${Math.min(albumsResult.albums.length, 500)}`);
      console.log(`- Top 500 artists generated: ${Math.min(artistsResult.artists.length, 500)}`);
      console.log(`- Top 100 albums with songs: ${Math.min(albumsWithSongsResult.albums.length, 100)}`);
      console.log(`- Total listening events: ${history.metadata.totalListeningEvents.toLocaleString()}`);
      
    } catch (error) {
      console.error('💥 Failed to generate cleaned files:', error);
      process.exit(1);
    }
  }
}

// Run the script if called directly
if (require.main === module) {
  const generator = new CleanedFilesGenerator();
  generator.generateCleanedFiles();
}

export { CleanedFilesGenerator };
