'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Music, Play, X } from 'lucide-react'
import SpotifyStatsLayout from '../../components/SpotifyStatsLayout'
import ViewToggle from '@/components/ViewToggle'
import SortToggle, { SortOption } from '@/components/SortToggle'

interface AlbumImage {
  height: number
  url: string
  width: number
}

interface Album {
  name: string
  images: AlbumImage[]
}

interface Artist {
  name: string
  genres: string[]
}

interface Song {
  name: string
  preview_url: string | null
  external_urls: Record<string, string>
}

interface SongData {
  duration_ms: number
  count: number
  songId: string
  song: Song
  album: Album
  artist: Artist
  consolidated_count: number
  original_songIds: string[]
  rank: number
}

interface SongsData {
  metadata: {
    originalTotalSongs: number
    consolidatedTotalSongs: number
    duplicatesRemoved: number
    consolidationRate: number
    timestamp: string
  }
  songs: SongData[]
}

// Lazy loading image component for songs
const LazySongImage = ({ album, rank, size = 'default' }: { album: Album; rank: number; size?: 'default' | 'mobile' }) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  
  const imageUrl = album.images?.[0]?.url
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    
    const imgRef = document.getElementById(`song-${rank}-${size}`)
    if (imgRef) {
      observer.observe(imgRef)
    }
    
    return () => observer.disconnect()
  }, [rank, size])
  
  return (
    <div 
      id={`song-${rank}-${size}`}
      className={`relative bg-muted rounded-lg overflow-hidden ${
        size === 'mobile' ? 'w-16 h-16' : 'aspect-square'
      }`}
    >
      {isInView && imageUrl ? (
        <Image
          src={imageUrl}
          alt={`${album.name} album cover`}
          fill
          className={`object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setIsLoaded(true)}
          sizes={size === 'mobile' ? '64px' : "(max-width: 768px) 150px, (max-width: 1024px) 200px, 250px"}
        />
      ) : (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">
          <Music className={`${size === 'mobile' ? 'w-6 h-6' : 'w-8 h-8'} text-muted-foreground`} />
        </div>
      )}
    </div>
  )
}

export default function TopSongsPage() {
  const [songsData, setSongsData] = useState<SongsData | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<SortOption>('plays')
  
  useEffect(() => {
    const fetchSongs = async () => {
      try {
        const response = await fetch('/api/data/songs', {
          cache: 'no-cache' // Validate with server but allow short-term caching
        })
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`)
        }
        const data = await response.json()
        setSongsData(data)
      } catch (error) {
        console.error('Error fetching songs:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchSongs()
  }, [])
  
  const filteredSongs = songsData?.songs.filter(song => 
    song.song.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    song.album.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    song.artist.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []
  
  // Sort filtered songs based on selected sort option
  const sortedSongs = [...filteredSongs].sort((a, b) => {
    switch (sortBy) {
      case 'duration':
        return (b.duration_ms || 0) - (a.duration_ms || 0)
      case 'plays':
      default:
        return b.count - a.count
    }
  })
  
  return (
    <SpotifyStatsLayout
      title="My Top Songs"
      description={loading ? 'Loading...' : `From ${songsData?.metadata.consolidatedTotalSongs} different songs from the past 15 years`}
      currentPage="songs"
      additionalControls={
        <div className="flex items-center gap-2">
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          <SortToggle 
            sortBy={sortBy} 
            onSortChange={setSortBy}
            options={[
              { value: 'plays', label: 'Total Plays' },
              { value: 'duration', label: 'Total Duration' },
            ]}
          />
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your top songs...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Search Bar */}
          <div className="relative max-w-md mx-auto mb-8">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search songs, albums, or artists..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Songs Display */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {sortedSongs.map((song) => (
              <Card key={song.songId} className="group hover:shadow-lg transition-shadow duration-200">
                <CardContent className="p-3">
                  {/* Album Image */}
                  <div className="mb-3">
                    <LazySongImage album={song.album} rank={song.rank} />
                  </div>
                  
                  {/* Song Info */}
                  <div className="space-y-2">
                    {/* Rank Badge */}
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        #{song.rank}
                      </Badge>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Play className="w-3 h-3 mr-1" />
                        {song.count}
                      </div>
                    </div>
                    
                    {/* Song Name */}
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {song.song.name}
                    </h3>
                    
                    {/* Artist Name */}
                    <button
                      onClick={() => setSearchTerm(song.artist.name)}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors line-clamp-1 text-left"
                    >
                      {song.artist.name}
                    </button>
                    
                    {/* Album Name */}
                    <button
                      onClick={() => setSearchTerm(song.album.name)}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors line-clamp-1 text-left"
                    >
                      {song.album.name}
                    </button>
                    
                    {/* Duration */}
                    <p className="text-xs text-muted-foreground">
                      {(() => {
                        const duration = song.duration_ms || 0
                        const totalMinutes = Math.floor(duration / 60000)
                        const hours = Math.floor(totalMinutes / 60)
                        const minutes = totalMinutes % 60
                        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
                      })()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {/* Header - Hidden on mobile */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-1 text-xs font-medium text-muted-foreground border-b">
              <div className="col-span-1">Rank</div>
              <div className="col-span-1"></div>
              <div className="col-span-3">Song</div>
              <div className="col-span-2">Artist</div>
              <div className="col-span-3">Album</div>
              <div className="col-span-1">Plays</div>
              <div className="col-span-1">Duration</div>
            </div>
            
            {sortedSongs.map((song) => (
              <Card key={song.songId} className="group hover:shadow-lg transition-shadow duration-200">
                <CardContent className="p-3 md:p-2">
                  {/* Desktop Layout */}
                  <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                    {/* Rank */}
                    <div className="col-span-1">
                      <Badge variant="secondary" className="text-xs">
                        #{song.rank}
                      </Badge>
                    </div>
                    
                    {/* Album Image */}
                    <div className="col-span-1">
                      <div className="w-12 h-12 aspect-square">
                        <LazySongImage album={song.album} rank={song.rank} />
                      </div>
                    </div>
                    
                    {/* Song Name */}
                    <div className="col-span-3">
                      <h3 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors">
                        {song.song.name}
                      </h3>
                    </div>
                    
                    {/* Artist Name */}
                    <div className="col-span-2">
                      <button
                        onClick={() => setSearchTerm(song.artist.name)}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors text-left"
                      >
                        {song.artist.name}
                      </button>
                    </div>
                    
                    {/* Album Name */}
                    <div className="col-span-3">
                      <button
                        onClick={() => setSearchTerm(song.album.name)}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors line-clamp-1 text-left"
                      >
                        {song.album.name}
                      </button>
                    </div>
                    
                    {/* Play Count */}
                    <div className="col-span-1">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Play className="w-3 h-3 mr-1" />
                        {song.count}
                      </div>
                    </div>
                    
                    {/* Duration */}
                    <div className="col-span-1">
                      <p className="text-sm text-muted-foreground">
                        {(() => {
                          const totalMinutes = Math.floor(song.duration_ms / 60000)
                          const hours = Math.floor(totalMinutes / 60)
                          const minutes = totalMinutes % 60
                          return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
                        })()}
                      </p>
                    </div>
                  </div>
                  
                  {/* Mobile Layout */}
                  <div className="md:hidden flex items-center gap-3">
                    {/* Album Image */}
                    <div className="flex-shrink-0">
                      <LazySongImage album={song.album} rank={song.rank} size="mobile" />
                    </div>
                    
                    {/* Song Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="secondary" className="text-xs">
                          #{song.rank}
                        </Badge>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Play className="w-3 h-3 mr-1" />
                          {song.count}
                        </div>
                      </div>
                      
                      <h3 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors mb-1">
                        {song.song.name}
                      </h3>
                      
                      <button
                        onClick={() => setSearchTerm(song.artist.name)}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors text-left mb-1"
                      >
                        {song.artist.name}
                      </button>
                      
                      <button
                        onClick={() => setSearchTerm(song.album.name)}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors mb-1 line-clamp-1 text-left"
                      >
                        {song.album.name}
                      </button>
                      
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          const totalMinutes = Math.floor(song.duration_ms / 60000)
                          const hours = Math.floor(totalMinutes / 60)
                          const minutes = totalMinutes % 60
                          return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
                        })()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
          {sortedSongs.length === 0 && searchTerm && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No songs found matching &quot;{searchTerm}&quot;</p>
            </div>
          )}
        </>
      )}
    </SpotifyStatsLayout>
  )
}
