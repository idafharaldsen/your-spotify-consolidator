import { NextResponse } from 'next/server'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    const dataDir = join(process.cwd(), '../data/cleaned-data')
    const files = await readdir(dataDir)
    const statsFile = files
      .filter(f => f.startsWith('detailed-stats-') && f.endsWith('.json'))
      .sort()
      .pop()
    
    if (!statsFile) {
      return NextResponse.json({ error: 'Stats data not found' }, { status: 404 })
    }
    
    const filePath = join(dataDir, statsFile)
    const fileContents = await readFile(filePath, 'utf-8')
    const data = JSON.parse(fileContents)
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error reading stats data:', error)
    return NextResponse.json({ error: 'Failed to load stats data' }, { status: 500 })
  }
}

