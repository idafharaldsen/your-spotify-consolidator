import { NextResponse } from 'next/server'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    const dataDir = join(process.cwd(), '../data/cleaned-data')
    const files = await readdir(dataDir)
    const albumFile = files
      .filter(f => f.startsWith('cleaned-albums-with-songs-') && f.endsWith('.json'))
      .sort()
      .pop()
    
    if (!albumFile) {
      return NextResponse.json({ error: 'Album with songs data not found' }, { status: 404 })
    }
    
    const filePath = join(dataDir, albumFile)
    const fileContents = await readFile(filePath, 'utf-8')
    const data = JSON.parse(fileContents)
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error reading album with songs data:', error)
    return NextResponse.json({ error: 'Failed to load album with songs data' }, { status: 500 })
  }
}

