import * as fs from 'fs';
import { glob } from 'glob';
import { uploadMultipleToVercelBlob, cleanupOldBlobFiles } from './vercel-blob-uploader';
import type { CompleteListeningHistory, CompleteSong, CleanedSong, CleanedAlbum, CleanedArtist, AlbumWithSongs } from './types';

/**
 * File operations for loading and saving cleaned data files
 */
export class FileOperations {
  /**
   * Find the most recent complete listening history file
   */
  findLatestCompleteHistoryFile(): string | null {
    let files = glob.sync('data/merged-streaming-history/merged-streaming-history-*.json');
    
    if (files.length === 0) {
      files = glob.sync('data/complete-listening-history/complete-listening-history-*.json');
    }
    
    if (files.length === 0) {
      console.log('⚠️  No complete listening history files found');
      return null;
    }
    
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
  loadCompleteHistory(filename: string): CompleteListeningHistory {
    try {
      const content = fs.readFileSync(filename, 'utf8');
      const data = JSON.parse(content);
      
      if (data.metadata && data.metadata.totalPlayEvents !== undefined) {
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
      
      return data;
    } catch (error) {
      throw new Error(`Failed to load complete history file: ${error}`);
    }
  }

  /**
   * Load existing cleaned files to preserve images
   */
  loadExistingCleanedFiles(): {
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
      const songsFiles = glob.sync('data/cleaned-data/cleaned-songs-*.json');
      const albumsFiles = glob.sync('data/cleaned-data/cleaned-albums-*.json');
      const artistsFiles = glob.sync('data/cleaned-data/cleaned-artists-*.json');
      const albumsWithSongsFiles = glob.sync('data/cleaned-data/cleaned-albums-with-songs-*.json');

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

      if (albumsFiles.length > 0) {
        albumsFiles.sort((a, b) => {
          const tsA = parseInt(a.match(/cleaned-albums-(\d+)\.json/)?.[1] || '0');
          const tsB = parseInt(b.match(/cleaned-albums-(\d+)\.json/)?.[1] || '0');
          return tsB - tsA;
        });
        const data = JSON.parse(fs.readFileSync(albumsFiles[0], 'utf8'));
        if (data.albums) {
          data.albums.forEach((album: CleanedAlbum) => {
            const nameKey = `${album.album.name.toLowerCase().trim()}|${(album.album.artists[0] || '').toLowerCase().trim()}`;
            result.albums.set(nameKey, album);
            if (album.primaryAlbumId) {
              result.albums.set(album.primaryAlbumId, album);
            }
          });
        }
      }

      if (artistsFiles.length > 0) {
        artistsFiles.sort((a, b) => {
          const tsA = parseInt(a.match(/cleaned-artists-(\d+)\.json/)?.[1] || '0');
          const tsB = parseInt(b.match(/cleaned-artists-(\d+)\.json/)?.[1] || '0');
          return tsB - tsA;
        });
        const data = JSON.parse(fs.readFileSync(artistsFiles[0], 'utf8'));
        if (data.artists) {
          data.artists.forEach((artist: CleanedArtist) => {
            const nameKey = artist.artist.name.toLowerCase().trim();
            result.artists.set(nameKey, artist);
            if (artist.primaryArtistId) {
              result.artists.set(artist.primaryArtistId, artist);
            }
          });
        }
      }

      if (albumsWithSongsFiles.length > 0) {
        albumsWithSongsFiles.sort((a, b) => {
          const tsA = parseInt(a.match(/cleaned-albums-with-songs-(\d+)\.json/)?.[1] || '0');
          const tsB = parseInt(b.match(/cleaned-albums-with-songs-(\d+)\.json/)?.[1] || '0');
          return tsB - tsA;
        });
        const data = JSON.parse(fs.readFileSync(albumsWithSongsFiles[0], 'utf8'));
        if (data.albums) {
          data.albums.forEach((album: AlbumWithSongs) => {
            const nameKey = `${album.album.name.toLowerCase().trim()}|${(album.album.artists[0] || '').toLowerCase().trim()}`;
            result.albumsWithSongs.set(nameKey, album);
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
   * Clean up old cleaned data files
   */
  cleanupOldCleanedFiles(): void {
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
  async saveCleanedFiles(
    songsResult: { songs: CleanedSong[], originalCount: number, consolidatedCount: number },
    albumsResult: { albums: CleanedAlbum[], originalCount: number, consolidatedCount: number },
    artistsResult: { artists: CleanedArtist[], originalCount: number, consolidatedCount: number },
    albumsWithSongs: AlbumWithSongs[],
    originalAlbumsCount: number,
    history: CompleteListeningHistory
  ): Promise<void> {
    if (!fs.existsSync('data/cleaned-data')) {
      fs.mkdirSync('data/cleaned-data', { recursive: true });
    }
    
    this.cleanupOldCleanedFiles();
    
    const timestamp = Date.now();
    
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
      songs: songsResult.songs.slice(0, 500)
    }, null, 2));

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
      albums: albumsResult.albums.slice(0, 500)
    }, null, 2));

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
      artists: artistsResult.artists.slice(0, 500)
    }, null, 2));

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
      albums: albumsWithSongs.slice(0, 100)
    }, null, 2));

    console.log(`\n📁 All cleaned files saved:`);
    console.log(`- Songs: ${songsFile}`);
    console.log(`- Albums: ${albumsFile}`);
    console.log(`- Artists: ${artistsFile}`);
    console.log(`- Albums with Songs: ${albumsWithSongsFile}`);

    const shouldUpload = process.env.UPLOAD_TO_VERCEL_BLOB !== 'false';
    if (shouldUpload) {
      try {
        console.log('\n☁️  Uploading files to Vercel Blob Storage...');
        await cleanupOldBlobFiles();
        
        const blobUrls = await uploadMultipleToVercelBlob([
          { filePath: songsFile, blobPath: 'cleaned-songs.json' },
          { filePath: albumsFile, blobPath: 'cleaned-albums.json' },
          { filePath: artistsFile, blobPath: 'cleaned-artists.json' },
          { filePath: albumsWithSongsFile, blobPath: 'cleaned-albums-with-songs.json' }
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
}

