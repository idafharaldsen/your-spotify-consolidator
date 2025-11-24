import { NextResponse } from 'next/server'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    const dataDir = join(process.cwd(), '../data/cleaned-data')
    const files = await readdir(dataDir)
    const songFile = files
      .filter(f => f.startsWith('cleaned-songs-') && f.endsWith('.json'))
      .sort()
      .pop()
    
    if (!songFile) {
      return NextResponse.json({ error: 'Song data not found' }, { status: 404 })
    }
    
    const filePath = join(dataDir, songFile)
    const fileContents = await readFile(filePath, 'utf-8')
    const data = JSON.parse(fileContents)
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error reading song data:', error)
    return NextResponse.json({ error: 'Failed to load song data' }, { status: 500 })
  }
}

