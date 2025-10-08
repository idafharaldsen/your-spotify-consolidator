import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface Song {
  songId: string;
  name: string;
  artists: string[];
  album: {
    name: string;
    images: any[];
  };
  playCount: number;
  totalListeningTime: number;
}

interface StreamingData {
  metadata: {
    totalSongs: number;
    totalPlayEvents: number;
    dateRange: {
      earliest: string;
      latest: string;
    };
  };
  songs: Song[];
}

export async function GET() {
  try {
    // Read the merged streaming history file
    const dataPath = path.join(process.cwd(), 'merged-streaming-history', 'merged-streaming-history-1759891992689.json');
    
    if (!fs.existsSync(dataPath)) {
      return NextResponse.json({ error: 'Data file not found' }, { status: 404 });
    }

    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data: StreamingData = JSON.parse(rawData);

    // Calculate summary stats
    const totalListeningTimeHours = Math.round(
      data.songs.reduce((sum, song) => sum + song.totalListeningTime, 0) / 1000 / 60 / 60
    );

    const topSongs = data.songs
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 5);

    // Group by artists
    const artistStats = new Map<string, { name: string; totalPlays: number; songCount: number }>();
    
    data.songs.forEach(song => {
      song.artists.forEach(artistName => {
        if (!artistStats.has(artistName)) {
          artistStats.set(artistName, { name: artistName, totalPlays: 0, songCount: 0 });
        }
        const stats = artistStats.get(artistName)!;
        stats.totalPlays += song.playCount;
        stats.songCount += 1;
      });
    });

    const topArtists = Array.from(artistStats.values())
      .sort((a, b) => b.totalPlays - a.totalPlays)
      .slice(0, 5);

    return NextResponse.json({
      summary: {
        totalSongs: data.metadata.totalSongs,
        totalPlayEvents: data.metadata.totalPlayEvents,
        totalListeningTimeHours,
        dateRange: data.metadata.dateRange
      },
      topSongs,
      topArtists
    });

  } catch (error) {
    console.error('Error reading data:', error);
    return NextResponse.json({ error: 'Failed to read data' }, { status: 500 });
  }
}
