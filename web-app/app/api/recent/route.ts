import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

interface ListeningEvent {
  playedAt: string;
  msPlayed: number;
}

interface RecentSong {
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
  listeningEvents: ListeningEvent[];
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
  songs: RecentSong[];
}

interface RecentPlayEvent {
  songId: string;
  songName: string;
  artistName: string;
  albumName: string;
  playedAt: string;
  msPlayed: number;
  albumImages: Array<{
    height: number;
    url: string;
    width: number;
  }>;
  spotifyUrl: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '100');
  
  try {
    // Find the latest merged streaming history file
    // Handle both development and production environments
    let files: string[] = [];
    
    // Try production path first (when deployed from root)
    const projectRoot = path.resolve(process.cwd(), '..');
    const dataPath = path.join(projectRoot, 'data', 'merged-streaming-history');
    files = glob.sync(path.join(dataPath, 'merged-streaming-history-*.json'));
    
    // Fallback to development path (when running from web-app directory)
    if (files.length === 0) {
      files = glob.sync('../data/merged-streaming-history/merged-streaming-history-*.json');
    }
    
    if (files.length === 0) {
      return NextResponse.json({ error: 'No merged streaming history found' }, { status: 404 });
    }
    
    // Sort by timestamp (newest first)
    files.sort((a, b) => {
      const timestampA = parseInt(a.match(/merged-streaming-history-(\d+)\.json/)?.[1] || '0');
      const timestampB = parseInt(b.match(/merged-streaming-history-(\d+)\.json/)?.[1] || '0');
      return timestampB - timestampA;
    });
    
    const latestFile = files[0];
    
    if (!fs.existsSync(latestFile)) {
      return NextResponse.json({ error: 'Data file not found' }, { status: 404 });
    }

    const rawData = fs.readFileSync(latestFile, 'utf8');
    const data: MergedStreamingHistory = JSON.parse(rawData);

    // Extract all listening events from all songs
    const allEvents: RecentPlayEvent[] = [];
    
    data.songs.forEach(song => {
      song.listeningEvents.forEach(event => {
        allEvents.push({
          songId: song.songId,
          songName: song.name,
          artistName: song.artist.name,
          albumName: song.album.name,
          playedAt: event.playedAt,
          msPlayed: event.msPlayed,
          albumImages: song.album.images,
          spotifyUrl: song.external_urls.spotify
        });
      });
    });

    // Sort by playedAt timestamp (most recent first)
    allEvents.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());

    // Take the most recent events
    const recentEvents = allEvents.slice(0, limit);

    // Return recent plays
    return NextResponse.json({
      recentPlays: recentEvents,
      metadata: {
        totalEvents: allEvents.length,
        returnedEvents: recentEvents.length,
        dateRange: data.metadata.dateRange,
        lastUpdated: data.metadata.timestamp,
        source: data.metadata.source
      }
    });

  } catch (error) {
    console.error('Error reading data:', error);
    return NextResponse.json({ error: 'Failed to read data' }, { status: 500 });
  }
}
