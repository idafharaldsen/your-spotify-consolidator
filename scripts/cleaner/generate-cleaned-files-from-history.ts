import { SpotifyTokenManager } from '../spotify-token-manager';
import { SpotifyApiClient } from './utils/spotify-api-client';
import { ConsolidationRulesManager, Consolidator } from './utils/consolidation';
import { FileOperations } from './utils/file-operations';
import type {
  CompleteListeningHistory,
  CompleteSong,
  CleanedSong,
  CleanedAlbum,
  CleanedArtist,
  AlbumWithSongs,
  AlbumSong,
  SpotifyTrack,
  DetailedStats,
  YearlyListeningTime,
  YearlyTopItems,
  TopSong,
  TopArtist
} from './utils/types';

class CleanedFilesGenerator {
  private tokenManager: SpotifyTokenManager | null = null;
  private spotifyApiClient: SpotifyApiClient;
  private rulesManager: ConsolidationRulesManager;
  private consolidator: Consolidator;
  private fileOps: FileOperations;

  constructor() {
    this.spotifyApiClient = new SpotifyApiClient();
    this.rulesManager = new ConsolidationRulesManager();
    this.consolidator = new Consolidator(this.rulesManager);
    this.fileOps = new FileOperations();
  }

  /**
   * Generate cleaned songs from complete history
   */
  private generateCleanedSongs(history: CompleteListeningHistory): { songs: CleanedSong[], originalCount: number, consolidatedCount: number } {
    console.log('🎵 Generating cleaned songs...');

    const songs: CleanedSong[] = history.songs.map(song => ({
      rank: 0,
      duration_ms: song.totalListeningTime,
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

    songs.sort((a, b) => b.count - a.count);
    const consolidatedSongs = this.consolidator.consolidateSongs(songs);
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

    const albumMap = new Map<string, {
      songs: CompleteSong[];
      totalPlayCount: number;
      totalListeningTime: number;
      differentSongs: Set<string>;
    }>();

    history.songs.forEach(song => {
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

    const albums: CleanedAlbum[] = Array.from(albumMap.entries()).map(([albumKey, data]) => {
      const firstSong = data.songs[0];
      const primaryAlbumId = firstSong.songId;
      
      return {
        rank: 0,
        duration_ms: data.songs.reduce((sum, song) => sum + song.duration_ms, 0),
        count: data.totalPlayCount,
        differents: data.differentSongs.size,
        primaryAlbumId: primaryAlbumId,
        total_count: data.totalPlayCount,
        total_duration_ms: data.totalListeningTime,
        album: {
          name: firstSong.album.name,
          album_type: 'album',
          artists: firstSong.artists,
          release_date: '',
          release_date_precision: 'day',
          popularity: 0,
          images: firstSong.album.images,
          external_urls: {},
          genres: firstSong.artist.genres
        },
        consolidated_count: data.totalPlayCount,
        original_albumIds: data.songs.map(song => song.album.id).filter(id => id !== '')
      };
    });

    albums.sort((a, b) => b.count - a.count);
    const consolidatedAlbums = this.consolidator.consolidateAlbums(albums);
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

    const artists: CleanedArtist[] = Array.from(artistMap.entries()).map(([artistName, data]) => {
      const firstSong = data.songs[0];
      
      return {
        rank: 0,
        duration_ms: data.songs.reduce((sum, song) => sum + song.duration_ms, 0),
        count: data.totalPlayCount,
        differents: data.differentSongs.size,
        primaryArtistId: firstSong.songId,
        total_count: data.totalPlayCount,
        total_duration_ms: data.totalListeningTime,
        artist: {
          name: artistName,
          genres: firstSong.artist.genres,
          popularity: 0,
          followers: {
            total: 0
          },
          images: [],
          external_urls: {}
        },
        consolidated_count: data.totalPlayCount,
        original_artistIds: [firstSong.songId]
      };
    });

    artists.sort((a, b) => b.count - a.count);
    const consolidatedArtists = this.consolidator.consolidateArtists(artists);
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
   * Generate albums with songs from complete history
   */
  private generateAlbumsWithSongs(history: CompleteListeningHistory): { albums: AlbumWithSongs[], originalCount: number } {
    console.log('💿🎵 Generating albums with songs...');

    const albumMap = new Map<string, CompleteSong[]>();
    history.songs.forEach(song => {
      if (!song.album.name || song.album.name.trim() === '') {
        return;
      }
      
      const albumName = song.album.name.trim();
      const songArtist = (song.artists[0] || song.artist.name || 'Unknown Artist').trim();
      const albumKey = `${albumName.toLowerCase()}|${songArtist.toLowerCase()}`;
      
      if (!albumMap.has(albumKey)) {
        albumMap.set(albumKey, []);
      }
      albumMap.get(albumKey)!.push(song);
    });

    const albumsWithSongs: AlbumWithSongs[] = Array.from(albumMap.entries()).map(([albumKey, songs]) => {
      const artistCounts = new Map<string, number>();
      songs.forEach(song => {
        const artist = (song.artists[0] || song.artist.name || '').trim();
        if (artist) {
          artistCounts.set(artist.toLowerCase(), (artistCounts.get(artist.toLowerCase()) || 0) + 1);
        }
      });
      
      let mostCommonArtist = '';
      let maxCount = 0;
      artistCounts.forEach((count, artist) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonArtist = artist;
        }
      });
      
      const representativeSong = songs.find(song => 
        (song.artists[0] || song.artist.name || '').toLowerCase().trim() === mostCommonArtist
      ) || songs[0];
      
      const matchingSongs = songs.filter(song => {
        const songArtist = (song.artists[0] || song.artist.name || '').toLowerCase().trim();
        return songArtist === mostCommonArtist || songArtist === '';
      });
      
      const validSongs = matchingSongs.length > 0 ? matchingSongs : songs;
      const totalPlayCount = validSongs.reduce((sum, song) => sum + song.playCount, 0);
      const totalListeningTime = validSongs.reduce((sum, song) => sum + song.totalListeningTime, 0);
      const playedSongs = validSongs.filter(song => song.playCount > 0).length;

      const albumSongs: AlbumSong[] = validSongs.map(song => ({
        songId: song.songId,
        name: song.name,
        duration_ms: song.duration_ms,
        track_number: 1,
        disc_number: 1,
        explicit: false,
        preview_url: song.preview_url,
        external_urls: song.external_urls,
        play_count: song.playCount,
        total_listening_time_ms: song.totalListeningTime,
        artists: song.artists
      }));

      const albumArtists = validSongs
        .map(s => s.artists[0] || s.artist.name)
        .filter((artist, index, arr) => arr.indexOf(artist) === index && artist)
        .slice(0, 1);

      const albumNameCounts = new Map<string, number>();
      validSongs.forEach(song => {
        const albumName = (song.album.name || '').trim();
        if (albumName) {
          albumNameCounts.set(albumName.toLowerCase(), (albumNameCounts.get(albumName.toLowerCase()) || 0) + 1);
        }
      });
      
      let mostCommonAlbumName = '';
      let maxAlbumCount = 0;
      albumNameCounts.forEach((count, albumName) => {
        if (count > maxAlbumCount) {
          maxAlbumCount = count;
          mostCommonAlbumName = albumName;
        }
      });
      
      const representativeSongForAlbum = validSongs.find(song => 
        (song.album.name || '').toLowerCase().trim() === mostCommonAlbumName
      ) || representativeSong;
      
      const finalAlbumName = mostCommonAlbumName 
        ? validSongs.find(s => (s.album.name || '').toLowerCase().trim() === mostCommonAlbumName)?.album.name || representativeSongForAlbum.album.name
        : representativeSongForAlbum.album.name;

      return {
        rank: 0,
        duration_ms: totalListeningTime,
        count: totalPlayCount,
        differents: validSongs.length,
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
        original_albumIds: validSongs.map(song => song.album.id).filter(id => id !== ''),
        total_songs: validSongs.length,
        played_songs: playedSongs,
        unplayed_songs: validSongs.length - playedSongs,
        songs: albumSongs.sort((a, b) => b.play_count - a.play_count)
      };
    });

    albumsWithSongs.sort((a, b) => b.count - a.count);
    const originalCount = albumsWithSongs.length;
    const consolidatedAlbums = this.consolidator.consolidateAlbumsWithSongs(albumsWithSongs);
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
   * Enrich cleaned songs with metadata from Spotify API
   */
  private async enrichSongsWithMetadata(songs: CleanedSong[], existingSongs: Map<string, CleanedSong>): Promise<CleanedSong[]> {
    if (!this.tokenManager) {
      console.log('ℹ️  Skipping song metadata enrichment (Spotify tokens not available)');
      return songs;
    }

    console.log('\n📥 Fetching song metadata from Spotify API...');
    
    const songsNeedingMetadata = songs.filter(song => {
      const existing = existingSongs.get(song.songId);
      const needsMetadata = !song.song.preview_url || !song.song.external_urls || Object.keys(song.song.external_urls).length === 0 || 
                           !song.album.images || song.album.images.length === 0;
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
    const tracks = await this.spotifyApiClient.fetchTracks(accessToken, uniqueSongIds);
    console.log(`✅ Fetched ${tracks.length} tracks`);

    const trackMap = new Map<string, SpotifyTrack>();
    tracks.forEach(track => trackMap.set(track.id, track));

    let enrichedCount = 0;
    songs.forEach(song => {
      const existing = existingSongs.get(song.songId);
      
      if (existing && existing.album.images && existing.album.images.length > 0) {
        song.album.images = existing.album.images;
      }

      const track = trackMap.get(song.songId);
      if (track) {
        song.song.preview_url = track.preview_url;
        song.song.external_urls = track.external_urls;
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
    
    const albumsNeedingMetadata = albums.filter(album => {
      const nameKey = `${album.album.name.toLowerCase().trim()}|${(album.album.artists[0] || '').toLowerCase().trim()}`;
      let existing = existingAlbums.get(nameKey);
      if (!existing && album.primaryAlbumId) {
        existing = existingAlbums.get(album.primaryAlbumId);
      }
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
    const songIds = albumsNeedingMetadata.map(album => album.primaryAlbumId).filter(id => id);
    const uniqueSongIds = Array.from(new Set(songIds));

    console.log(`   Fetching ${uniqueSongIds.length} unique tracks to get album IDs (${albums.length - uniqueSongIds.length} already have metadata)...`);
    const tracks = await this.spotifyApiClient.fetchTracks(accessToken, uniqueSongIds);
    console.log(`✅ Fetched ${tracks.length} tracks`);

    const albumIds = new Set<string>();
    const songIdToAlbumId = new Map<string, string>();
    tracks.forEach(track => {
      if (track.album && track.album.id) {
        albumIds.add(track.album.id);
        songIdToAlbumId.set(track.id, track.album.id);
      }
    });

    console.log(`   Found ${albumIds.size} unique album IDs`);
    const albumsMap = await this.spotifyApiClient.fetchAlbums(accessToken, Array.from(albumIds));
    console.log(`✅ Fetched ${albumsMap.size} albums`);

    const trackMap = new Map<string, SpotifyTrack>();
    tracks.forEach(track => trackMap.set(track.id, track));

    let enrichedCount = 0;
    albums.forEach(album => {
      const nameKey = `${album.album.name.toLowerCase().trim()}|${(album.album.artists[0] || '').toLowerCase().trim()}`;
      let existing = existingAlbums.get(nameKey);
      if (!existing && album.primaryAlbumId) {
        existing = existingAlbums.get(album.primaryAlbumId);
      }
      
      if (existing && existing.album.images && existing.album.images.length > 0) {
        album.album.images = existing.album.images;
      }

      const track = trackMap.get(album.primaryAlbumId);
      const albumId = songIdToAlbumId.get(album.primaryAlbumId);
      const spotifyAlbum = albumId ? albumsMap.get(albumId) : null;

      if (track || spotifyAlbum) {
        if (albumId) {
          album.primaryAlbumId = albumId;
        }

        if (spotifyAlbum) {
          album.album.name = spotifyAlbum.name;
          album.album.artists = spotifyAlbum.artists.map(a => a.name);
          album.album.album_type = spotifyAlbum.album_type;
          album.album.release_date = spotifyAlbum.release_date;
          album.album.release_date_precision = spotifyAlbum.release_date_precision;
          album.album.popularity = spotifyAlbum.popularity;
          if (!album.album.images || album.album.images.length === 0) {
            album.album.images = spotifyAlbum.images;
          }
          album.album.external_urls = spotifyAlbum.external_urls;
          album.album.genres = spotifyAlbum.genres;
        } else if (track) {
          album.album.name = track.album.name;
          album.album.artists = track.album.artists.map(a => a.name);
          album.album.album_type = track.album.album_type;
          album.album.release_date = track.album.release_date;
          album.album.release_date_precision = track.album.release_date_precision;
          if (!album.album.images || album.album.images.length === 0) {
            album.album.images = track.album.images;
          }
          album.album.external_urls = track.album.external_urls;
        }

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

    const enrichedMap = new Map<string, CleanedAlbum>();
    cleanedAlbums.forEach((original, index) => {
      const originalSongId = original.primaryAlbumId;
      if (enrichedAlbums[index]) {
        enrichedMap.set(originalSongId, enrichedAlbums[index]);
      }
    });

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

    return await this.enrichAndConsolidateAlbumSongs(albumsWithEnrichedMetadata);
  }

  /**
   * Enrich songs within albums with track numbers and consolidate duplicates
   */
  private async enrichAndConsolidateAlbumSongs(albums: AlbumWithSongs[]): Promise<AlbumWithSongs[]> {
    if (!this.tokenManager) {
      return albums.map(album => ({
        ...album,
        songs: this.consolidator.consolidateSongsInAlbum(album.songs)
      }));
    }

    console.log('\n📥 Fetching track metadata for album songs...');
    
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
    
    const trackMap = new Map<string, SpotifyTrack>();
    const batchSize = 50;
    for (let i = 0; i < uniqueSongIds.length; i += batchSize) {
      const batch = uniqueSongIds.slice(i, i + batchSize);
      const tracks = await this.spotifyApiClient.fetchTracks(accessToken, batch);
      tracks.forEach(track => trackMap.set(track.id, track));
      
      if (i + batchSize < uniqueSongIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`✅ Fetched ${trackMap.size} tracks`);

    return albums.map(album => {
      const consolidatedSongs = this.consolidator.consolidateSongsInAlbum(album.songs);
      
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
      
      enrichedSongs.sort((a, b) => {
        if (a.disc_number !== b.disc_number) {
          return a.disc_number - b.disc_number;
        }
        if (a.track_number !== b.track_number) {
          return a.track_number - b.track_number;
        }
        return b.play_count - a.play_count;
      });

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
    
    const artistsNeedingMetadata = artists.filter(artist => {
      const nameKey = artist.artist.name.toLowerCase().trim();
      let existing = existingArtists.get(nameKey);
      if (!existing && artist.primaryArtistId) {
        existing = existingArtists.get(artist.primaryArtistId);
      }
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
    const songIds = artistsNeedingMetadata.map(artist => artist.primaryArtistId).filter(id => id);
    const uniqueSongIds = Array.from(new Set(songIds));

    console.log(`   Fetching ${uniqueSongIds.length} unique tracks to get artist IDs (${artists.length - uniqueSongIds.length} already have metadata)...`);
    const tracks = await this.spotifyApiClient.fetchTracks(accessToken, uniqueSongIds);
    console.log(`✅ Fetched ${tracks.length} tracks`);

    const artistIds = new Set<string>();
    const songIdToArtistId = new Map<string, string>();
    tracks.forEach(track => {
      if (track.artists && track.artists.length > 0) {
        const artistId = track.artists[0].id;
        if (artistId) {
          artistIds.add(artistId);
          songIdToArtistId.set(track.id, artistId);
        }
      }
    });

    console.log(`   Found ${artistIds.size} unique artist IDs`);
    const artistsMap = await this.spotifyApiClient.fetchArtists(accessToken, Array.from(artistIds));
    console.log(`✅ Fetched ${artistsMap.size} artists`);

    let enrichedCount = 0;
    artists.forEach(artist => {
      const nameKey = artist.artist.name.toLowerCase().trim();
      let existing = existingArtists.get(nameKey);
      if (!existing && artist.primaryArtistId) {
        existing = existingArtists.get(artist.primaryArtistId);
      }
      
      if (existing && existing.artist.images && existing.artist.images.length > 0) {
        artist.artist.images = existing.artist.images;
      }

      const artistId = songIdToArtistId.get(artist.primaryArtistId);
      const spotifyArtist = artistId ? artistsMap.get(artistId) : null;

      if (spotifyArtist) {
        artist.primaryArtistId = artistId!;
        artist.original_artistIds = [artistId!];
        artist.artist.popularity = spotifyArtist.popularity;
        artist.artist.followers = spotifyArtist.followers;
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
   * Calculate detailed statistics from listening history
   */
  private calculateDetailedStats(history: CompleteListeningHistory): DetailedStats {
    console.log('📊 Calculating detailed statistics...');
    
    // Maps to track yearly data
    const yearlyMap = new Map<string, { totalMs: number; playCount: number }>();
    const yearlySongsMap = new Map<string, Map<string, { playCount: number; totalMs: number; name: string; artist: string; images: Array<{ height: number; url: string; width: number }> }>>();
    const yearlyArtistsMap = new Map<string, Map<string, { playCount: number; totalMs: number; uniqueSongs: Set<string>; images: Array<{ height: number; url: string; width: number }>; representativeSongId: string | null }>>();
    
    history.songs.forEach(song => {
      song.listeningEvents.forEach(event => {
        const year = new Date(event.playedAt).getFullYear().toString();
        
        // Update yearly totals
        if (!yearlyMap.has(year)) {
          yearlyMap.set(year, { totalMs: 0, playCount: 0 });
        }
        const yearData = yearlyMap.get(year)!;
        yearData.totalMs += event.msPlayed;
        yearData.playCount += 1;
        
        // Track songs per year
        if (!yearlySongsMap.has(year)) {
          yearlySongsMap.set(year, new Map());
        }
        const yearSongsMap = yearlySongsMap.get(year)!;
        if (!yearSongsMap.has(song.songId)) {
          yearSongsMap.set(song.songId, {
            playCount: 0,
            totalMs: 0,
            name: song.name,
            artist: song.artist.name || song.artists[0] || 'Unknown Artist',
            images: song.album.images || []
          });
        }
        const songData = yearSongsMap.get(song.songId)!;
        songData.playCount += 1;
        songData.totalMs += event.msPlayed;
        // Update images if we get better ones (non-empty images)
        if (song.album.images && song.album.images.length > 0 && (!songData.images || songData.images.length === 0)) {
          songData.images = song.album.images;
        }
        
        // Track artists per year
        if (!yearlyArtistsMap.has(year)) {
          yearlyArtistsMap.set(year, new Map());
        }
        const yearArtistsMap = yearlyArtistsMap.get(year)!;
        const artistName = song.artist.name || song.artists[0] || 'Unknown Artist';
        if (!yearArtistsMap.has(artistName)) {
          yearArtistsMap.set(artistName, {
            playCount: 0,
            totalMs: 0,
            uniqueSongs: new Set(),
            images: [],
            representativeSongId: null
          });
        }
        const artistData = yearArtistsMap.get(artistName)!;
        artistData.playCount += 1;
        artistData.totalMs += event.msPlayed;
        artistData.uniqueSongs.add(song.songId);
        // Store a representative song ID for later artist lookup
        if (!artistData.representativeSongId && song.songId) {
          artistData.representativeSongId = song.songId;
        }
        // Use album images from the artist's songs (prefer images with higher resolution)
        if (song.album.images && song.album.images.length > 0) {
          // If we don't have images yet, or if this song's album has better images, update
          if (artistData.images.length === 0) {
            artistData.images = song.album.images;
          } else {
            // Prefer images with higher resolution (larger height)
            const currentMaxHeight = Math.max(...artistData.images.map(img => img.height));
            const newMaxHeight = Math.max(...song.album.images.map(img => img.height));
            if (newMaxHeight > currentMaxHeight) {
              artistData.images = song.album.images;
            }
          }
        }
      });
    });
    
    // Convert to array and sort by year
    const yearlyListeningTime: YearlyListeningTime[] = Array.from(yearlyMap.entries())
      .map(([year, data]) => ({
        year,
        totalListeningTimeMs: data.totalMs,
        totalListeningHours: Math.round((data.totalMs / (1000 * 60 * 60)) * 100) / 100,
        playCount: data.playCount
      }))
      .sort((a, b) => a.year.localeCompare(b.year));
    
    // Calculate top songs and artists per year
    const yearlyTopItems: YearlyTopItems[] = Array.from(yearlySongsMap.keys())
      .sort()
      .map(year => {
        // Get top 5 songs for this year
        const songsMap = yearlySongsMap.get(year)!;
        const topSongs: TopSong[] = Array.from(songsMap.entries())
          .map(([songId, data]) => ({
            songId,
            name: data.name,
            artist: data.artist,
            playCount: data.playCount,
            totalListeningTimeMs: data.totalMs,
            images: data.images || []
          }))
          .sort((a, b) => b.playCount - a.playCount)
          .slice(0, 5);
        
        // Get top 5 artists for this year
        const artistsMap = yearlyArtistsMap.get(year)!;
        const topArtists: TopArtist[] = Array.from(artistsMap.entries())
          .map(([artistName, data]) => ({
            artistName,
            playCount: data.playCount,
            totalListeningTimeMs: data.totalMs,
            uniqueSongs: data.uniqueSongs.size,
            images: data.images || []
          }))
          .sort((a, b) => b.playCount - a.playCount)
          .slice(0, 5);
        
        return {
          year,
          topSongs,
          topArtists
        };
      });
    
    // Calculate totals
    const totalListeningTimeMs = yearlyListeningTime.reduce((sum, year) => sum + year.totalListeningTimeMs, 0);
    const totalListeningHours = Math.round((totalListeningTimeMs / (1000 * 60 * 60)) * 100) / 100;
    const totalListeningDays = Math.round((totalListeningHours / 24) * 100) / 100;
    
    return {
      yearlyListeningTime,
      yearlyTopItems,
      totalListeningHours,
      totalListeningDays
    };
  }

  /**
   * Enrich detailed stats with actual artist images from Spotify API
   */
  private async enrichDetailedStatsWithArtistImages(
    detailedStats: DetailedStats,
    existingArtists: Map<string, CleanedArtist>,
    history: CompleteListeningHistory
  ): Promise<DetailedStats> {
    if (!this.tokenManager) {
      console.log('ℹ️  Skipping artist image enrichment for detailed stats (Spotify tokens not available)');
      return detailedStats;
    }

    console.log('\n📥 Enriching detailed stats with artist images from Spotify API...');
    
    // Collect all unique artist names from yearly top items
    const artistNameToYearlyData = new Map<string, { year: string; artist: TopArtist }>();
    detailedStats.yearlyTopItems.forEach(yearData => {
      yearData.topArtists.forEach(artist => {
        const key = artist.artistName.toLowerCase().trim();
        if (!artistNameToYearlyData.has(key)) {
          artistNameToYearlyData.set(key, { year: yearData.year, artist });
        }
      });
    });

    // First, try to match with existing cleaned artists
    const artistNameToImages = new Map<string, Array<{ height: number; url: string; width: number }>>();
    const artistsNeedingLookup = new Map<string, { year: string; artist: TopArtist; representativeSongId?: string }>();

    artistNameToYearlyData.forEach((data, artistNameKey) => {
      // Try to find in existing cleaned artists
      let found = existingArtists.get(artistNameKey);
      if (!found) {
        // Try exact match
        for (const [key, artist] of existingArtists.entries()) {
          if (key.toLowerCase().trim() === artistNameKey) {
            found = artist;
            break;
          }
        }
      }

      if (found && found.artist.images && found.artist.images.length > 0) {
        artistNameToImages.set(artistNameKey, found.artist.images);
      } else {
        // Need to look up this artist
        artistsNeedingLookup.set(artistNameKey, data);
      }
    });

    console.log(`   Found ${artistNameToImages.size} artists in existing cleaned data`);
    console.log(`   Need to lookup ${artistsNeedingLookup.size} artists from Spotify API`);

    // For artists not found, we need to get their artist IDs
    // We'll need to find a representative song for each artist and get the artist ID from the track
    if (artistsNeedingLookup.size > 0) {
      // Create a map of artist name to song IDs from history
      const artistToSongIds = new Map<string, string[]>();
      history.songs.forEach(song => {
        const artistName = (song.artist.name || song.artists[0] || '').toLowerCase().trim();
        if (artistName && artistsNeedingLookup.has(artistName)) {
          if (!artistToSongIds.has(artistName)) {
            artistToSongIds.set(artistName, []);
          }
          if (song.songId) {
            artistToSongIds.get(artistName)!.push(song.songId);
          }
        }
      });

      // Get representative song IDs for each artist
      const songIdsToFetch = new Set<string>();
      const artistNameToSongId = new Map<string, string>();
      
      artistsNeedingLookup.forEach((data, artistNameKey) => {
        const songIds = artistToSongIds.get(artistNameKey);
        if (songIds && songIds.length > 0) {
          const songId = songIds[0]; // Use first available song
          songIdsToFetch.add(songId);
          artistNameToSongId.set(artistNameKey, songId);
        }
      });

      if (songIdsToFetch.size > 0) {
        const accessToken = await this.tokenManager.getValidAccessToken();
        console.log(`   Fetching ${songIdsToFetch.size} tracks to get artist IDs...`);
        const tracks = await this.spotifyApiClient.fetchTracks(accessToken, Array.from(songIdsToFetch));
        console.log(`✅ Fetched ${tracks.length} tracks`);

        // Extract artist IDs from tracks
        const artistIds = new Set<string>();
        const artistNameToArtistId = new Map<string, string>();
        
        tracks.forEach(track => {
          if (track.artists && track.artists.length > 0) {
            const artistId = track.artists[0].id;
            const artistName = track.artists[0].name.toLowerCase().trim();
            if (artistId) {
              artistIds.add(artistId);
              // Find which artist name this corresponds to
              for (const [nameKey, songId] of artistNameToSongId.entries()) {
                if (songId === track.id) {
                  artistNameToArtistId.set(nameKey, artistId);
                  break;
                }
              }
            }
          }
        });

        if (artistIds.size > 0) {
          console.log(`   Found ${artistIds.size} unique artist IDs, fetching artist metadata...`);
          const artistsMap = await this.spotifyApiClient.fetchArtists(accessToken, Array.from(artistIds));
          console.log(`✅ Fetched ${artistsMap.size} artists`);

          // Map artist IDs back to artist names and store images
          artistNameToArtistId.forEach((artistId, artistNameKey) => {
            const spotifyArtist = artistsMap.get(artistId);
            if (spotifyArtist && spotifyArtist.images && spotifyArtist.images.length > 0) {
              artistNameToImages.set(artistNameKey, spotifyArtist.images);
            }
          });
        }
      }
    }

    // Update detailed stats with enriched images
    let enrichedCount = 0;
    detailedStats.yearlyTopItems.forEach(yearData => {
      yearData.topArtists.forEach(artist => {
        const artistNameKey = artist.artistName.toLowerCase().trim();
        const images = artistNameToImages.get(artistNameKey);
        if (images && images.length > 0) {
          artist.images = images;
          enrichedCount++;
        }
      });
    });

    console.log(`✅ Enriched ${enrichedCount} artists with images from Spotify API`);
    return detailedStats;
  }

  /**
   * Main function to generate all cleaned files
   */
  async generateCleanedFiles(): Promise<void> {
    try {
      console.log('🚀 Generating All Cleaned Files from Complete Listening History');
      console.log('================================================================');
      
      const historyFile = this.fileOps.findLatestCompleteHistoryFile();
      if (!historyFile) {
        console.log('⚠️  No complete listening history found');
        return;
      }
      
      console.log(`📁 Loading complete history from: ${historyFile}`);
      const history = this.fileOps.loadCompleteHistory(historyFile);
      
      // Calculate detailed statistics
      let detailedStats = this.calculateDetailedStats(history);
      
      const songsResult = this.generateCleanedSongs(history);
      const albumsResult = this.generateCleanedAlbums(history);
      const artistsResult = this.generateCleanedArtists(history);
      const albumsWithSongsResult = this.generateAlbumsWithSongs(history);
      
      const existingFiles = this.fileOps.loadExistingCleanedFiles();
      
      await this.initializeSpotifyToken();
      
      if (this.tokenManager) {
        console.log('\n🎵 Enriching cleaned files with Spotify metadata...');
        songsResult.songs = await this.enrichSongsWithMetadata(songsResult.songs, existingFiles.songs);
        albumsResult.albums = await this.enrichAlbumsWithMetadata(albumsResult.albums, existingFiles.albums);
        artistsResult.artists = await this.enrichArtistsWithMetadata(artistsResult.artists, existingFiles.artists);
        albumsWithSongsResult.albums = await this.enrichAlbumsWithSongsMetadata(albumsWithSongsResult.albums, existingFiles.albumsWithSongs);
        
        // Enrich detailed stats with actual artist images
        const enrichedStats = await this.enrichDetailedStatsWithArtistImages(detailedStats, existingFiles.artists, history);
        detailedStats = enrichedStats;
      }
      
      const timestamp = await this.fileOps.saveCleanedFiles(songsResult, albumsResult, artistsResult, albumsWithSongsResult.albums, albumsWithSongsResult.originalCount, history);
      await this.fileOps.saveDetailedStats(detailedStats, timestamp);
      
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
      console.log('');
      console.log('📈 Detailed Statistics:');
      console.log(`- Total listening time: ${detailedStats.totalListeningHours.toLocaleString()} hours (${detailedStats.totalListeningDays.toLocaleString()} days)`);
      console.log('- Listening time by year:');
      detailedStats.yearlyListeningTime.forEach(year => {
        console.log(`  • ${year.year}: ${year.totalListeningHours.toLocaleString()} hours (${year.playCount.toLocaleString()} plays)`);
      });
      console.log('');
      console.log('🎵 Top Songs & Artists by Year:');
      detailedStats.yearlyTopItems.forEach(yearData => {
        console.log(`\n  📅 ${yearData.year}:`);
        console.log('    Top 5 Songs:');
        yearData.topSongs.forEach((song, index) => {
          console.log(`      ${index + 1}. "${song.name}" by ${song.artist} (${song.playCount} plays)`);
        });
        console.log('    Top 5 Artists:');
        yearData.topArtists.forEach((artist, index) => {
          console.log(`      ${index + 1}. ${artist.artistName} (${artist.playCount} plays, ${artist.uniqueSongs} unique songs)`);
        });
      });
      
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
