import * as fs from 'fs';
import { glob } from 'glob';
import { uploadMultipleToVercelBlob, cleanupOldBlobFiles, deleteFromVercelBlob } from './vercel-blob-uploader';
import type { CompleteListeningHistory, CompleteSong, CleanedSong, CleanedAlbum, CleanedArtist, AlbumWithSongs, DetailedStats, YearlyTopItems, TopSong, TopArtist } from './types';

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
        /^cleaned-artists-\d+\.json$/,
        /^cleaned-albums-with-songs-\d+\.json$/,
        /^detailed-stats-\d+\.json$/
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
    artistsResult: { artists: CleanedArtist[], originalCount: number, consolidatedCount: number },
    albumsWithSongs: AlbumWithSongs[],
    originalAlbumsCount: number,
    history: CompleteListeningHistory,
    timestamp?: number
  ): Promise<number> {
    if (!fs.existsSync('data/cleaned-data')) {
      fs.mkdirSync('data/cleaned-data', { recursive: true });
    }
    
    this.cleanupOldCleanedFiles();
    
    const fileTimestamp = timestamp || Date.now();
    
    const songsFile = `data/cleaned-data/cleaned-songs-${fileTimestamp}.json`;
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

    const artistsFile = `data/cleaned-data/cleaned-artists-${fileTimestamp}.json`;
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

    const albumsWithSongsFile = `data/cleaned-data/cleaned-albums-with-songs-${fileTimestamp}.json`;
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
      albums: albumsWithSongs.slice(0, 500)
    }, null, 2));

    console.log(`\n📁 All cleaned files saved:`);
    console.log(`- Songs: ${songsFile}`);
    console.log(`- Artists: ${artistsFile}`);
    console.log(`- Albums with Songs: ${albumsWithSongsFile}`);

    const shouldUpload = process.env.UPLOAD_TO_VERCEL_BLOB !== 'false';
    if (shouldUpload) {
      try {
        console.log('\n☁️  Uploading files to Vercel Blob Storage...');
        await cleanupOldBlobFiles();
        
        const filesToUpload = [
          { filePath: songsFile, blobPath: 'cleaned-songs.json' },
          { filePath: artistsFile, blobPath: 'cleaned-artists.json' },
          { filePath: albumsWithSongsFile, blobPath: 'cleaned-albums-with-songs.json' }
        ];
        
        const blobUrls = await uploadMultipleToVercelBlob(filesToUpload);

        console.log('\n✅ All files uploaded to Vercel Blob Storage:');
        blobUrls.forEach((url, index) => {
          const fileNames = ['Songs', 'Artists', 'Albums with Songs'];
          console.log(`- ${fileNames[index]}: ${url}`);
        });
      } catch (error) {
        console.error('\n⚠️  Failed to upload files to Vercel Blob Storage:', error);
        console.error('Files are still saved locally. Set UPLOAD_TO_VERCEL_BLOB=false to skip upload.');
      }
    } else {
      console.log('\n⏭️  Skipping Vercel Blob Storage upload (UPLOAD_TO_VERCEL_BLOB=false)');
    }
    
    return fileTimestamp;
  }

  /**
   * Save detailed statistics to JSON file
   */
  async saveDetailedStats(detailedStats: DetailedStats, timestamp: number): Promise<string> {
    if (!fs.existsSync('data/cleaned-data')) {
      fs.mkdirSync('data/cleaned-data', { recursive: true });
    }
    
    const statsFile = `data/cleaned-data/detailed-stats-${timestamp}.json`;
    
    // Verify we have enriched data before saving
    let songsWithImages = 0;
    let artistsWithImages = 0;
    detailedStats.yearlyTopItems.forEach((yearData: YearlyTopItems) => {
      yearData.topSongs.forEach((song: TopSong) => {
        if (song.images && song.images.length > 0) {
          songsWithImages++;
        }
      });
      yearData.topArtists.forEach((artist: TopArtist) => {
        if (artist.images && artist.images.length > 0) {
          artistsWithImages++;
        }
      });
    });
    
    const totalSongs = detailedStats.yearlyTopItems.reduce((sum: number, year: YearlyTopItems) => sum + year.topSongs.length, 0);
    const totalArtists = detailedStats.yearlyTopItems.reduce((sum: number, year: YearlyTopItems) => sum + year.topArtists.length, 0);
    
    console.log(`\n📊 Detailed Stats Summary:`);
    console.log(`   Songs with images: ${songsWithImages} / ${totalSongs}`);
    console.log(`   Artists with images: ${artistsWithImages} / ${totalArtists}`);
    
    const fileContent = JSON.stringify({
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'Merged Streaming History'
      },
      stats: detailedStats
    }, null, 2);
    
    fs.writeFileSync(statsFile, fileContent);
    
    // Verify file was written correctly by checking it exists and has content
    if (!fs.existsSync(statsFile)) {
      throw new Error(`Failed to write detailed stats file: ${statsFile}`);
    }
    
    // Verify the written file contains the enriched data
    const writtenContent = fs.readFileSync(statsFile, 'utf8');
    const writtenData = JSON.parse(writtenContent) as { stats?: DetailedStats };
    let writtenSongsWithImages = 0;
    let writtenArtistsWithImages = 0;
    if (writtenData.stats && writtenData.stats.yearlyTopItems) {
      writtenData.stats.yearlyTopItems.forEach((yearData: YearlyTopItems) => {
        if (yearData.topSongs) {
          yearData.topSongs.forEach((song: TopSong) => {
            if (song.images && song.images.length > 0) {
              writtenSongsWithImages++;
            }
          });
        }
        if (yearData.topArtists) {
          yearData.topArtists.forEach((artist: TopArtist) => {
            if (artist.images && artist.images.length > 0) {
              writtenArtistsWithImages++;
            }
          });
        }
      });
    }
    
    const fileSize = fs.statSync(statsFile).size;
    console.log(`- Detailed Stats: ${statsFile} (${(fileSize / 1024).toFixed(2)} KB)`);
    console.log(`   Verified: ${writtenSongsWithImages} songs and ${writtenArtistsWithImages} artists with images in saved file`);
    
    const shouldUpload = process.env.UPLOAD_TO_VERCEL_BLOB !== 'false';
    if (shouldUpload) {
      try {
        // Delete old detailed-stats.json from blob storage before uploading new one
        console.log('   Cleaning up old detailed-stats.json from blob storage...');
        try {
          await deleteFromVercelBlob('detailed-stats.json');
          console.log('   ✅ Old file deleted successfully');
          // Wait a bit for deletion to propagate
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error: any) {
          // Check if it's a 404 (file doesn't exist) - that's fine
          if (error?.status === 404 || error?.message?.includes('not found')) {
            console.log('   ℹ️  Old detailed-stats.json not found (will upload new one)');
          } else {
            console.error('   ⚠️  Failed to delete old file, but continuing with upload:', error);
          }
        }
        
        // Small delay to ensure file is fully flushed to disk
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Verify file still exists and has content before uploading
        if (!fs.existsSync(statsFile)) {
          throw new Error(`Stats file disappeared before upload: ${statsFile}`);
        }
        
        // Read the file again right before upload to ensure we're uploading the correct content
        const fileToUpload = fs.readFileSync(statsFile, 'utf8');
        const uploadData = JSON.parse(fileToUpload) as { metadata?: { timestamp?: string }, stats?: DetailedStats };
        const uploadTimestamp = uploadData.metadata?.timestamp;
        
        // Verify the file we're about to upload has enriched data
        let uploadSongsWithImages = 0;
        let uploadArtistsWithImages = 0;
        if (uploadData.stats && uploadData.stats.yearlyTopItems) {
          uploadData.stats.yearlyTopItems.forEach((yearData: YearlyTopItems) => {
            yearData.topSongs.forEach((song: TopSong) => {
              if (song.images && song.images.length > 0) {
                uploadSongsWithImages++;
              }
            });
            yearData.topArtists.forEach((artist: TopArtist) => {
              if (artist.images && artist.images.length > 0) {
                uploadArtistsWithImages++;
              }
            });
          });
        }
        
        console.log(`   Uploading file with timestamp: ${uploadTimestamp}`);
        console.log(`   File contains: ${uploadSongsWithImages} songs and ${uploadArtistsWithImages} artists with images`);
        
        if (uploadSongsWithImages === 0 && uploadArtistsWithImages === 0) {
          console.error('⚠️  ERROR: File being uploaded has NO images! Aborting upload.');
          console.error('   This indicates enrichment did not complete or failed.');
          throw new Error('Cannot upload file without images - enrichment may have failed');
        }
        
        // Upload the file - this should overwrite any existing file
        await uploadMultipleToVercelBlob([
          { filePath: statsFile, blobPath: 'detailed-stats.json' }
        ]);
        
        // Verify upload succeeded
        console.log('✅ Detailed stats uploaded to Vercel Blob Storage');
        console.log(`   Successfully uploaded: ${uploadSongsWithImages} songs and ${uploadArtistsWithImages} artists with images`);
      } catch (error) {
        console.error('⚠️  Failed to upload detailed stats to Vercel Blob Storage:', error);
      }
    }
    
    return statsFile;
  }
}

