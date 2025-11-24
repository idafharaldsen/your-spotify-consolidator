import { NextResponse } from 'next/server'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    const dataDir = join(process.cwd(), '../data/cleaned-data')
    const files = await readdir(dataDir)
    const artistFile = files
      .filter(f => f.startsWith('cleaned-artists-') && f.endsWith('.json'))
      .sort()
      .pop()
    
    if (!artistFile) {
      return NextResponse.json({ error: 'Artist data not found' }, { status: 404 })
    }
    
    const filePath = join(dataDir, artistFile)
    const fileContents = await readFile(filePath, 'utf-8')
    const data = JSON.parse(fileContents)
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error reading artist data:', error)
    return NextResponse.json({ error: 'Failed to load artist data' }, { status: 500 })
  }
}

