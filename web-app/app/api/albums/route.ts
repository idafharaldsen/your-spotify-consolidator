import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

interface CleanedAlbum {
  duration_ms: number;
  count: number;
  albumId: string;
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
  original_albumIds: string[];
  original_counts: number[];
  rank: number;
}

interface CleanedAlbumsData {
  metadata: {
    originalTotalAlbums: number;
    consolidatedTotalAlbums: number;
    duplicatesRemoved: number;
    consolidationRate: number;
    timestamp: string;
    source: string;
    totalListeningEvents: number;
  };
  albums: CleanedAlbum[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');
  
  try {
    // Find the latest cleaned-albums file
    // Handle both development and production environments
    let files: string[] = [];
    
    // Try production path first (when deployed from root)
    const projectRoot = path.resolve(process.cwd(), '..');
    const dataPath = path.join(projectRoot, 'data', 'cleaned-data');
    files = glob.sync(path.join(dataPath, 'cleaned-albums-*.json'));
    
    // Fallback to development path (when running from web-app directory)
    if (files.length === 0) {
      files = glob.sync('../data/cleaned-data/cleaned-albums-*.json');
    }
    
    if (files.length === 0) {
      return NextResponse.json({ error: 'No cleaned albums data found' }, { status: 404 });
    }
    
    // Sort by timestamp (newest first)
    files.sort((a, b) => {
      const timestampA = parseInt(a.match(/cleaned-albums-(\d+)\.json/)?.[1] || '0');
      const timestampB = parseInt(b.match(/cleaned-albums-(\d+)\.json/)?.[1] || '0');
      return timestampB - timestampA;
    });
    
    const latestFile = files[0];
    
    if (!fs.existsSync(latestFile)) {
      return NextResponse.json({ error: 'Data file not found' }, { status: 404 });
    }

    const rawData = fs.readFileSync(latestFile, 'utf8');
    const data: CleanedAlbumsData = JSON.parse(rawData);

    // Albums are already sorted by count (highest first) in the cleaned data
    const paginatedAlbums = data.albums.slice(offset, offset + limit);

    // Return paginated results
    return NextResponse.json({
      albums: paginatedAlbums,
      pagination: {
        limit,
        offset,
        total: data.albums.length,
        hasMore: offset + limit < data.albums.length
      },
      metadata: {
        totalAlbums: data.metadata.consolidatedTotalAlbums,
        originalTotalAlbums: data.metadata.originalTotalAlbums,
        duplicatesRemoved: data.metadata.duplicatesRemoved,
        consolidationRate: data.metadata.consolidationRate,
        totalListeningEvents: data.metadata.totalListeningEvents || 0,
        timestamp: data.metadata.timestamp,
        source: data.metadata.source || 'unknown'
      }
    });

  } catch (error) {
    console.error('Error reading data:', error);
    return NextResponse.json({ error: 'Failed to read data' }, { status: 500 });
  }
}
