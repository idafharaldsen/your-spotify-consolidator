import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

interface CleanedSong {
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
  original_counts: number[];
  rank: number;
}

interface CleanedSongsData {
  metadata: {
    originalTotalSongs: number;
    consolidatedTotalSongs: number;
    duplicatesRemoved: number;
    consolidationRate: number;
    timestamp: string;
    source: string;
    totalListeningEvents: number;
  };
  songs: CleanedSong[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');
  
  try {
    // Find the latest cleaned-songs file
    const files = glob.sync('cleaned-data/cleaned-songs-*.json');
    
    if (files.length === 0) {
      return NextResponse.json({ error: 'No cleaned songs data found' }, { status: 404 });
    }
    
    // Sort by timestamp (newest first)
    files.sort((a, b) => {
      const timestampA = parseInt(a.match(/cleaned-songs-(\d+)\.json/)?.[1] || '0');
      const timestampB = parseInt(b.match(/cleaned-songs-(\d+)\.json/)?.[1] || '0');
      return timestampB - timestampA;
    });
    
    const latestFile = files[0];
    const dataPath = path.join(process.cwd(), latestFile);
    
    if (!fs.existsSync(dataPath)) {
      return NextResponse.json({ error: 'Data file not found' }, { status: 404 });
    }

    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data: CleanedSongsData = JSON.parse(rawData);

    // Songs are already sorted by count (highest first) in the cleaned data
    const paginatedSongs = data.songs.slice(offset, offset + limit);

    // Return paginated results
    return NextResponse.json({
      songs: paginatedSongs,
      pagination: {
        limit,
        offset,
        total: data.songs.length,
        hasMore: offset + limit < data.songs.length
      },
      metadata: {
        totalSongs: data.metadata.consolidatedTotalSongs,
        originalTotalSongs: data.metadata.originalTotalSongs,
        duplicatesRemoved: data.metadata.duplicatesRemoved,
        consolidationRate: data.metadata.consolidationRate,
        totalListeningEvents: data.metadata.totalListeningEvents,
        timestamp: data.metadata.timestamp,
        source: data.metadata.source
      }
    });

  } catch (error) {
    console.error('Error reading data:', error);
    return NextResponse.json({ error: 'Failed to read data' }, { status: 500 });
  }
}
