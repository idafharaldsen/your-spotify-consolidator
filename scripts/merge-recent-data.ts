import fs from 'fs';
import path from 'path';

interface RecentPlayData {
  id: string;
  name: string;
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
  duration_ms: number;
  played_at: string;
  external_urls: {
    spotify: string;
  };
  preview_url: string | null;
}

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
  songs: CompleteSong[];
  metadata: {
    totalSongs: number;
    totalListeningTime: number;
    dateRange: {
      earliest: string;
      latest: string;
    };
    source: string;
    lastUpdated: string;
  };
}

class DataMerger {
  private dataDir = 'data';
  private mergedDir = path.join(this.dataDir, 'merged-streaming-history');
  private tempDir = 'temp';

  constructor() {
    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  private ensureDirectories(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.mergedDir)) {
      fs.mkdirSync(this.mergedDir, { recursive: true });
    }
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Find the most recent recent-plays file
   */
  private findLatestRecentPlaysFile(): string | null {
    const files = fs.readdirSync(this.tempDir)
      .filter(file => file.startsWith('temp-recent-plays-') && file.endsWith('.json'))
      .sort()
      .reverse();

    return files.length > 0 ? path.join(this.tempDir, files[0]) : null;
  }

  /**
   * Find the most recent merged streaming history file
   */
  private findLatestMergedFile(): string | null {
    const files = fs.readdirSync(this.mergedDir)
      .filter(file => file.startsWith('merged-streaming-history-') && file.endsWith('.json'))
      .sort()
      .reverse();

    return files.length > 0 ? path.join(this.mergedDir, files[0]) : null;
  }

  /**
   * Load recent plays data
   */
  private loadRecentPlays(filePath: string): RecentPlayData[] {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`❌ Error loading recent plays from ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Load existing merged data
   */
  private loadExistingData(filePath: string): CompleteListeningHistory {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`❌ Error loading existing data from ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Merge recent plays with existing data
   */
  private mergeData(existingData: CompleteListeningHistory, recentPlays: RecentPlayData[]): CompleteListeningHistory {
    console.log('🔄 Merging recent plays with existing data...');
    
    // Create a map of existing songs for quick lookup
    const existingSongsMap = new Map<string, CompleteSong>();
    existingData.songs.forEach(song => {
      const key = `${song.name.toLowerCase().trim()}|${song.artists[0]?.toLowerCase().trim() || 'unknown'}`;
      existingSongsMap.set(key, song);
    });

    // Clean up existing duplicates in the data
    let duplicatesRemoved = 0;
    existingSongsMap.forEach(song => {
      const originalCount = song.listeningEvents.length;
      const uniqueEvents = song.listeningEvents.filter((event, index, self) => 
        index === self.findIndex(e => e.playedAt === event.playedAt)
      );
      
      if (uniqueEvents.length !== originalCount) {
        duplicatesRemoved += (originalCount - uniqueEvents.length);
        song.listeningEvents = uniqueEvents;
        song.playCount = uniqueEvents.length;
        song.totalListeningTime = uniqueEvents.reduce((sum, event) => sum + event.msPlayed, 0);
      }
    });

    if (duplicatesRemoved > 0) {
      console.log(`🧹 Cleaned up ${duplicatesRemoved} duplicate listening events from existing data`);
    }

    let existingSongsUpdated = 0;
    let newSongsAdded = 0;
    const newSongs: CompleteSong[] = [];

    // Process each recent play
    recentPlays.forEach(play => {
      const key = `${play.name.toLowerCase().trim()}|${play.artists[0]?.toLowerCase().trim() || 'unknown'}`;
      
      if (existingSongsMap.has(key)) {
        // Update existing song (maintains chronological position)
        const existingSong = existingSongsMap.get(key)!;
        
        // Check if this exact play time already exists to avoid duplicates
        const playTimeExists = existingSong.listeningEvents.some(event => event.playedAt === play.played_at);
        
        if (!playTimeExists) {
          existingSong.playCount += 1;
          existingSong.totalListeningTime += play.duration_ms;
          // Update duration_ms if it was missing (0) and we have it from recent plays
          if (existingSong.duration_ms === 0 && play.duration_ms > 0) {
            existingSong.duration_ms = play.duration_ms;
          }
          existingSong.listeningEvents.push({
            playedAt: play.played_at,
            msPlayed: play.duration_ms
          });
          existingSongsUpdated++;
          console.log(`🔄 Updated: "${play.name}" by ${play.artists[0]} (+1 play)`);
        } else {
          console.log(`🔄 Skipped duplicate: "${play.name}" by ${play.artists[0]} (already exists at ${play.played_at})`);
        }
      } else {
        // Add new song (will be appended to end)
        const newSong: CompleteSong = {
          songId: play.id,
          name: play.name,
          duration_ms: play.duration_ms,
          artists: play.artists,
          album: play.album,
          artist: {
            name: play.artists[0] || 'Unknown Artist',
            genres: [] // We don't have genre data from recent plays
          },
          external_urls: play.external_urls,
          preview_url: play.preview_url,
          playCount: 1,
          totalListeningTime: play.duration_ms,
          listeningEvents: [{
            playedAt: play.played_at,
            msPlayed: play.duration_ms
          }]
        };
        newSongs.push(newSong);
        newSongsAdded++;
        console.log(`➕ Added new song: "${play.name}" by ${play.artists[0]}`);
      }
    });

    // Combine existing songs with new songs
    const allSongs = [...existingData.songs, ...newSongs];

    // Calculate updated metadata
    const totalListeningTime = allSongs.reduce((sum, song) => sum + song.totalListeningTime, 0);
    const allPlayedAtTimes = allSongs.flatMap(song => song.listeningEvents.map(event => event.playedAt));
    const earliest = allPlayedAtTimes.length > 0 ? new Date(Math.min(...allPlayedAtTimes.map(time => new Date(time).getTime()))).toISOString() : existingData.metadata.dateRange.earliest;
    const latest = allPlayedAtTimes.length > 0 ? new Date(Math.max(...allPlayedAtTimes.map(time => new Date(time).getTime()))).toISOString() : existingData.metadata.dateRange.latest;

    console.log(`📊 Merge summary:`);
    console.log(`- Existing songs updated: ${existingSongsUpdated}`);
    console.log(`- New songs added: ${newSongsAdded}`);
    console.log(`- Total recent plays processed: ${recentPlays.length}`);
    console.log(`- Total songs now: ${allSongs.length}`);

    return {
      songs: allSongs,
      metadata: {
        totalSongs: allSongs.length,
        totalListeningTime,
        dateRange: {
          earliest,
          latest
        },
        source: 'Merged Streaming History',
        lastUpdated: new Date().toISOString()
      }
    };
  }

  /**
   * Save merged data to file
   */
  private saveMergedData(data: CompleteListeningHistory): string {
    const timestamp = Date.now();
    const filename = `merged-streaming-history-${timestamp}.json`;
    const filePath = path.join(this.mergedDir, filename);

    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`💾 Saved merged data to: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error(`❌ Error saving merged data:`, error);
      throw error;
    }
  }

  /**
   * Clean up temporary recent-plays files
   */
  private cleanupTempFiles(): void {
    console.log('🧹 Cleaning up temporary recent-plays files...');
    
    try {
      const files = fs.readdirSync(this.tempDir)
        .filter(file => file.startsWith('temp-recent-plays-') && file.endsWith('.json'));

      files.forEach(file => {
        const filePath = path.join(this.tempDir, file);
        fs.unlinkSync(filePath);
        console.log(`   ✅ Deleted ${file}`);
      });
    } catch (error) {
      console.error(`⚠️  Error cleaning up temp files:`, error);
    }
  }

  /**
   * Main merge process
   */
  public async merge(): Promise<void> {
    try {
      console.log('🔄 Starting data merge process...');

      // Find latest recent plays file
      const recentPlaysFile = this.findLatestRecentPlaysFile();
      if (!recentPlaysFile) {
        console.log('⚠️  No recent-plays files found');
        console.log('⚠️  No recent plays data to merge');
        return;
      }

      console.log(`📁 Loading recent plays from: ${recentPlaysFile}`);
      const recentPlays = this.loadRecentPlays(recentPlaysFile);

      // Find latest merged file
      const existingDataFile = this.findLatestMergedFile();
      if (!existingDataFile) {
        console.log('❌ No existing merged data found');
        console.log('❌ Cannot merge without existing data');
        return;
      }

      console.log(`📁 Loading existing data from: ${existingDataFile}`);
      const existingData = this.loadExistingData(existingDataFile);

      // Merge the data
      const mergedData = this.mergeData(existingData, recentPlays);

      // Save merged data
      this.saveMergedData(mergedData);

      // Clean up temp files
      this.cleanupTempFiles();

      console.log('🎉 Data merge completed successfully!');

    } catch (error) {
      console.error('❌ Merge process failed:', error);
      throw error;
    }
  }
}

// Run the merge process
const merger = new DataMerger();
merger.merge().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
