import * as fs from 'fs';
import { glob } from 'glob';
import { SpotifyTokenManager } from './spotify-token-manager';

interface CompleteListeningHistory {
  metadata: {
    dateRange: {
      latest: string;
    };
  };
}

/**
 * Check if there are new recent plays since last run
 * Exits with code 0 if new tracks exist, 1 if no new tracks
 */
async function checkForNewTracks(): Promise<void> {
  try {
    console.log('🔍 Checking for new recent plays...');
    
    // Find the latest merged streaming history file
    let files = glob.sync('data/merged-streaming-history/merged-streaming-history-*.json');
    
    if (files.length === 0) {
      console.log('ℹ️  No existing history found, will process all data');
      process.exit(0); // No history means we should process
    }

    // Sort by timestamp (newest first)
    files.sort((a, b) => {
      const timestampA = parseInt(a.match(/merged-streaming-history-(\d+)\.json/)?.[1] || '0');
      const timestampB = parseInt(b.match(/merged-streaming-history-(\d+)\.json/)?.[1] || '0');
      return timestampB - timestampA;
    });

    const historyFile = files[0];
    const historyData = JSON.parse(fs.readFileSync(historyFile, 'utf8')) as CompleteListeningHistory;
    const latestTimestamp = historyData.metadata?.dateRange?.latest;
    
    if (!latestTimestamp) {
      console.log('ℹ️  No timestamp found in history, will process all data');
      process.exit(0); // No timestamp means we should process
    }

    const latestHistoryTime = new Date(latestTimestamp).getTime();
    console.log(`📅 Latest track in history: ${latestTimestamp}`);

    // Check API for latest track
    const tokenManager = new SpotifyTokenManager();
    const accessToken = await tokenManager.getValidAccessToken();
    const isValid = await tokenManager.testToken(accessToken);
    
    if (!isValid) {
      console.log('⚠️  Invalid token, cannot check for new tracks. Proceeding with processing...');
      process.exit(0); // If we can't check, proceed to be safe
    }

    // Fetch the last 10 tracks to check timestamps
    const response = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=10', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      console.log('⚠️  Failed to fetch recent plays, proceeding with processing...');
      process.exit(0); // If API fails, proceed to be safe
    }

    const data = await response.json() as { items: Array<{ track: { name: string; artists: Array<{ name: string }> }; played_at: string }> };
    
    if (data.items && data.items.length > 0) {
      console.log(`\n📋 Last ${data.items.length} tracks from Spotify API:`);
      console.log('='.repeat(60));
      
      let hasNewTracks = false;
      
      data.items.forEach((item, index) => {
        const playedAt = item.played_at;
        const playedAtTime = new Date(playedAt).getTime();
        const isNewer = playedAtTime > latestHistoryTime;
        
        if (isNewer) {
          hasNewTracks = true;
        }
        
        const status = isNewer ? '🆕 NEW' : '✅ OLD';
        console.log(`${(index + 1).toString().padStart(2, ' ')}. ${status}`);
        console.log(`    "${item.track.name}" by ${item.track.artists.map(a => a.name).join(', ')}`);
        console.log(`    Played at: ${playedAt}`);
        console.log('');
      });
      
      console.log('='.repeat(60));
      console.log(`📅 Latest track from Spotify API: ${data.items[0].played_at}`);
      
      if (hasNewTracks) {
        console.log('✅ New tracks found since last run!');
        process.exit(0); // Exit 0 = continue workflow
      } else {
        console.log('ℹ️  No new tracks since last run. Skipping workflow.');
        process.exit(1); // Exit 1 = stop workflow
      }
    } else {
      console.log('ℹ️  No recent plays found in API response');
      process.exit(1); // No plays = stop workflow
    }
  } catch (error) {
    console.error('❌ Error checking for new recent plays:', error);
    console.log('⚠️  Proceeding with processing to be safe...');
    process.exit(0); // If check fails, proceed to be safe
  }
}

// Run the check
checkForNewTracks();

