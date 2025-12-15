import * as fs from 'fs';
import * as path from 'path';
import type { CleanedSong, CleanedAlbum, CleanedArtist, AlbumWithSongs, AlbumSong, ConsolidationRules, ConsolidationRule } from './types';

/**
 * Consolidation rules manager
 */
export class ConsolidationRulesManager {
  private consolidationRules: Map<string, string> | null = null;
  private consolidationRulesData: ConsolidationRules | null = null;

  /**
   * Load consolidation rules from JSON file
   */
  loadConsolidationRules(): Map<string, string> {
    if (this.consolidationRules) {
      return this.consolidationRules;
    }

    const rulesMap = new Map<string, string>();
    
    try {
      // Path relative to this file's directory (both files are in scripts/cleaner/utils/)
      const rulesPath = path.join(__dirname, 'album-consolidation-rules.json');
      if (fs.existsSync(rulesPath)) {
        const rulesData = JSON.parse(fs.readFileSync(rulesPath, 'utf8')) as ConsolidationRules;
        this.consolidationRulesData = rulesData;
        
        rulesData.rules.forEach((rule: ConsolidationRule) => {
          const artistKey = rule.artistName.toLowerCase().trim();
          const baseAlbumName = rule.baseAlbumName.toLowerCase().trim();
          
          rule.variations.forEach((variation: string) => {
            const variationKey = variation.toLowerCase().trim();
            const mapKey = `${artistKey}|${variationKey}`;
            rulesMap.set(mapKey, baseAlbumName);
          });
          
          const baseKey = `${artistKey}|${baseAlbumName}`;
          rulesMap.set(baseKey, baseAlbumName);
        });
        
        console.log(`📋 Loaded ${rulesData.rules.length} consolidation rules`);
      } else {
        console.log('ℹ️  No consolidation rules file found (scripts/cleaner/utils/album-consolidation-rules.json)');
      }
    } catch (error) {
      console.error('⚠️  Failed to load consolidation rules:', error);
    }
    
    this.consolidationRules = rulesMap;
    return rulesMap;
  }

  /**
   * Normalize album name using consolidation rules
   */
  normalizeAlbumName(albumName: string, artistName: string): string {
    const rules = this.loadConsolidationRules();
    const key = `${artistName.toLowerCase().trim()}|${albumName.toLowerCase().trim()}`;
    const normalized = rules.get(key);
    
    if (normalized) {
      return normalized;
    }
    
    return albumName.toLowerCase().trim();
  }

  /**
   * Get the base album name with correct casing from consolidation rules
   */
  getBaseAlbumName(albumName: string, artistName: string): string | null {
    if (!this.consolidationRulesData) {
      return null;
    }
    
    const normalized = this.normalizeAlbumName(albumName, artistName);
    const rule = this.consolidationRulesData.rules.find((r: ConsolidationRule) => 
      r.artistName.toLowerCase().trim() === artistName.toLowerCase().trim() &&
      r.baseAlbumName.toLowerCase().trim() === normalized
    );
    
    return rule ? rule.baseAlbumName : null;
  }
}

/**
 * Consolidation functions
 */
export class Consolidator {
  constructor(private rulesManager: ConsolidationRulesManager) {}
  
  /**
   * Normalize album name for grouping (public wrapper)
   */
  normalizeAlbumNameForGrouping(albumName: string, artistName: string): string {
    return this.rulesManager.normalizeAlbumName(albumName, artistName);
  }
  
  /**
   * Get base album name for grouping (public wrapper)
   */
  getBaseAlbumNameForGrouping(albumName: string, artistName: string): string | null {
    return this.rulesManager.getBaseAlbumName(albumName, artistName);
  }

  /**
   * Consolidate songs by name and artist
   */
  consolidateSongs(songs: CleanedSong[]): CleanedSong[] {
    console.log('🔄 Consolidating songs...');
    
    const consolidationMap = new Map<string, CleanedSong>();
    let duplicatesRemoved = 0;
    
    songs.forEach(song => {
      const key = `${song.song.name.toLowerCase().trim()}|${song.artist.name.toLowerCase().trim()}`;
      
      if (consolidationMap.has(key)) {
        const existing = consolidationMap.get(key)!;
        existing.count += song.count;
        existing.consolidated_count += song.count;
        existing.duration_ms += song.duration_ms;
        existing.original_songIds.push(song.songId);
        duplicatesRemoved++;
      } else {
        const finalSong = {
          ...song,
          consolidated_count: song.count
        };
        
        // Normalize album name using consolidation rules
        const baseAlbumName = this.rulesManager.getBaseAlbumName(song.album.name, song.artist.name);
        if (baseAlbumName) {
          finalSong.album.name = baseAlbumName;
        }
        
        consolidationMap.set(key, finalSong);
      }
    });
    
    const consolidatedSongs = Array.from(consolidationMap.values())
      .sort((a, b) => b.count - a.count);
    
    console.log(`📊 Songs: ${songs.length} → ${consolidatedSongs.length} (${duplicatesRemoved} duplicates removed)`);
    return consolidatedSongs;
  }

  /**
   * Consolidate albums by name and first artist, using consolidation rules
   */
  consolidateAlbums(albums: CleanedAlbum[]): CleanedAlbum[] {
    console.log('🔄 Consolidating albums...');
    
    const consolidationMap = new Map<string, CleanedAlbum>();
    let duplicatesRemoved = 0;
    
    albums.forEach(album => {
      const firstArtist = album.album.artists[0] || 'Unknown Artist';
      const normalizedAlbumName = this.rulesManager.normalizeAlbumName(album.album.name, firstArtist);
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
        
        // Always try to get the base album name for both existing and incoming albums
        const existingBaseName = this.rulesManager.getBaseAlbumName(existing.album.name, firstArtist) ||
                                 this.rulesManager.getBaseAlbumName(this.rulesManager.normalizeAlbumName(existing.album.name, firstArtist), firstArtist);
        const incomingBaseName = this.rulesManager.getBaseAlbumName(album.album.name, firstArtist) ||
                                this.rulesManager.getBaseAlbumName(this.rulesManager.normalizeAlbumName(album.album.name, firstArtist), firstArtist);
        const baseName = existingBaseName || incomingBaseName;
        
        if (baseName) {
          existing.album.name = baseName;
        }
        
        const normalizedBaseName = this.rulesManager.normalizeAlbumName(album.album.name, firstArtist);
        if (normalizedBaseName !== existing.album.name.toLowerCase().trim()) {
          if (album.count > existing.count || 
              (album.album.images && album.album.images.length > 0 && (!existing.album.images || existing.album.images.length === 0))) {
            existing.album.images = album.album.images.length > 0 ? album.album.images : existing.album.images;
            existing.album.external_urls = Object.keys(album.album.external_urls).length > 0 ? album.album.external_urls : existing.album.external_urls;
          }
        }
        duplicatesRemoved++;
      } else {
        const finalAlbum = {
          ...album,
          consolidated_count: album.count
        };
        
        const baseName = this.rulesManager.getBaseAlbumName(album.album.name, firstArtist);
        if (baseName) {
          finalAlbum.album.name = baseName;
        }
        
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
  consolidateArtists(artists: CleanedArtist[]): CleanedArtist[] {
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
   * Consolidate albums with songs, using consolidation rules
   */
  consolidateAlbumsWithSongs(albums: AlbumWithSongs[]): AlbumWithSongs[] {
    console.log('🔄 Consolidating albums with songs...');
    
    const consolidationMap = new Map<string, AlbumWithSongs>();
    let duplicatesRemoved = 0;
    
    albums.forEach(album => {
      const firstArtist = album.album.artists[0] || 'Unknown Artist';
      const normalizedAlbumName = this.rulesManager.normalizeAlbumName(album.album.name, firstArtist);
      const key = `${normalizedAlbumName}|${firstArtist.toLowerCase().trim()}`;
      
      if (consolidationMap.has(key)) {
        const existing = consolidationMap.get(key)!;
        existing.count += album.count;
        existing.total_duration_ms += album.total_duration_ms;
        existing.consolidated_count += album.consolidated_count;
        existing.original_albumIds.push(...album.original_albumIds);
        
        const songMap = new Map<string, AlbumSong>();
        existing.songs.forEach((song: AlbumSong) => {
          const songKey = `${song.name.toLowerCase().trim()}|${song.artists.join(', ').toLowerCase()}`;
          songMap.set(songKey, song);
        });
        
        album.songs.forEach((song: AlbumSong) => {
          const songKey = `${song.name.toLowerCase().trim()}|${song.artists.join(', ').toLowerCase()}`;
          if (songMap.has(songKey)) {
            const existingSong = songMap.get(songKey)!;
            existingSong.play_count += song.play_count;
            existingSong.total_listening_time_ms += song.total_listening_time_ms;
          } else {
            songMap.set(songKey, song);
          }
        });
        
        existing.songs = Array.from(songMap.values()).sort((a: AlbumSong, b: AlbumSong) => b.play_count - a.play_count);
        existing.total_songs = existing.songs.length;
        existing.played_songs = existing.songs.filter((song: AlbumSong) => song.play_count > 0).length;
        existing.unplayed_songs = existing.songs.filter((song: AlbumSong) => song.play_count === 0).length;
        
        // Update earliest_played_at to be the earliest between existing and new album
        if (album.earliest_played_at) {
          if (!existing.earliest_played_at || album.earliest_played_at < existing.earliest_played_at) {
            existing.earliest_played_at = album.earliest_played_at;
          }
        }
        
        // Merge yearly play time
        if (album.yearly_play_time && album.yearly_play_time.length > 0) {
          const yearlyPlayTimeMap = new Map<string, number>();
          
          // Add existing yearly play time
          if (existing.yearly_play_time && existing.yearly_play_time.length > 0) {
            existing.yearly_play_time.forEach(yearData => {
              yearlyPlayTimeMap.set(yearData.year, yearData.totalListeningTimeMs);
            });
          }
          
          // Merge new yearly play time
          album.yearly_play_time.forEach(yearData => {
            const existingMs = yearlyPlayTimeMap.get(yearData.year) || 0;
            yearlyPlayTimeMap.set(yearData.year, existingMs + yearData.totalListeningTimeMs);
          });
          
          // Convert back to sorted array
          existing.yearly_play_time = Array.from(yearlyPlayTimeMap.entries())
            .map(([year, totalListeningTimeMs]) => ({
              year,
              totalListeningTimeMs
            }))
            .sort((a, b) => a.year.localeCompare(b.year));
        } else if (!existing.yearly_play_time && album.yearly_play_time) {
          // If existing doesn't have yearly play time but new one does, use the new one
          existing.yearly_play_time = album.yearly_play_time;
        }
        
        // Always try to get the base album name for both existing and incoming albums
        const existingBaseName = this.rulesManager.getBaseAlbumName(existing.album.name, firstArtist) ||
                                 this.rulesManager.getBaseAlbumName(this.rulesManager.normalizeAlbumName(existing.album.name, firstArtist), firstArtist);
        const incomingBaseName = this.rulesManager.getBaseAlbumName(album.album.name, firstArtist) ||
                                this.rulesManager.getBaseAlbumName(this.rulesManager.normalizeAlbumName(album.album.name, firstArtist), firstArtist);
        const baseName = existingBaseName || incomingBaseName;
        
        if (baseName) {
          existing.album.name = baseName;
        }
        
        const normalizedBaseName = this.rulesManager.normalizeAlbumName(album.album.name, firstArtist);
        if (normalizedBaseName !== existing.album.name.toLowerCase().trim()) {
          if (album.count > existing.count || 
              (album.album.images && album.album.images.length > 0 && (!existing.album.images || existing.album.images.length === 0))) {
            existing.album.images = album.album.images.length > 0 ? album.album.images : existing.album.images;
            existing.album.external_urls = Object.keys(album.album.external_urls).length > 0 ? album.album.external_urls : existing.album.external_urls;
          }
        }
        duplicatesRemoved++;
      } else {
        const finalAlbum = { ...album };
        // Try to get base name from the album name, or from the normalized name
        const baseName = this.rulesManager.getBaseAlbumName(album.album.name, firstArtist) ||
                        this.rulesManager.getBaseAlbumName(this.rulesManager.normalizeAlbumName(album.album.name, firstArtist), firstArtist);
        if (baseName) {
          finalAlbum.album.name = baseName;
        }
        finalAlbum.songs = finalAlbum.songs.sort((a: AlbumSong, b: AlbumSong) => b.play_count - a.play_count);
        consolidationMap.set(key, finalAlbum);
      }
    });
    
    const consolidatedAlbums = Array.from(consolidationMap.values())
      .sort((a, b) => b.count - a.count);
    
    console.log(`📊 Albums with songs: ${albums.length} → ${consolidatedAlbums.length} (${duplicatesRemoved} duplicates removed)`);
    return consolidatedAlbums;
  }

  /**
   * Consolidate duplicate songs within an album
   */
  consolidateSongsInAlbum(songs: AlbumSong[]): AlbumSong[] {
    const songMap = new Map<string, AlbumSong>();
    
    songs.forEach(song => {
      const songKey = `${song.name.toLowerCase().trim()}|${song.artists.join(', ').toLowerCase().trim()}`;
      
      if (songMap.has(songKey)) {
        const existing = songMap.get(songKey)!;
        const existingOriginalPlays = existing.play_count;
        existing.play_count += song.play_count;
        existing.total_listening_time_ms += song.total_listening_time_ms;
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
}

