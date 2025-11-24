'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Music, Play, X, Disc } from 'lucide-react'
import SpotifyStatsLayout from '../../components/SpotifyStatsLayout'
import ViewToggle from '@/components/ViewToggle'

interface AlbumImage {
  height: number
  url: string
  width: number
}

interface Album {
  name: string
  album_type: string
  artists: string[]
  release_date: string
  release_date_precision: string
  popularity: number
  images: AlbumImage[]
  external_urls: {
    spotify: string
  }
  genres: string[]
}

interface AlbumData {
  duration_ms: number
  count: number
  differents: number
  primaryAlbumId: string
  total_count: number
  total_duration_ms: number
  album: Album
  consolidated_count: number
  original_albumIds: string[]
  original_counts: number[]
  rank: number
}

interface AlbumsData {
  metadata: {
    originalTotalAlbums: number
    consolidatedTotalAlbums: number
    duplicatesRemoved: number
    consolidationRate: number
    timestamp: string
  }
  albums: AlbumData[]
}

// Lazy loading image component
const LazyAlbumImage = ({ album, rank, size = 'default' }: { album: Album; rank: number; size?: 'default' | 'mobile' }) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  
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
    
    const imgRef = document.getElementById(`album-${rank}-${size}`)
    if (imgRef) {
      observer.observe(imgRef)
    }
    
    return () => observer.disconnect()
  }, [rank, size])
  
  // Guard clause to prevent errors with invalid album data
  if (!album) {
    return (
      <div className={`relative bg-muted rounded-lg overflow-hidden ${
        size === 'mobile' ? 'w-16 h-16' : 'aspect-square'
      }`}>
        <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
          <Disc className={`${size === 'mobile' ? 'w-6 h-6' : 'w-8 h-8'} text-muted-foreground`} />
        </div>
      </div>
    )
  }
  
  const imageUrl = album.images?.[0]?.url
  
  return (
    <div 
      id={`album-${rank}-${size}`}
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

export default function TopAlbumsPage() {
  const [albumsData, setAlbumsData] = useState<AlbumsData | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  useEffect(() => {
    const fetchAlbums = async () => {
      try {
        const response = await fetch('/api/data/albums', {
          cache: 'no-cache' // Validate with server but allow short-term caching
        })
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`)
        }
        const data = await response.json()
        setAlbumsData(data)
      } catch (error) {
        console.error('Error fetching albums:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchAlbums()
  }, [])
  
  const filteredAlbums = albumsData?.albums.filter(album => 
    album.album.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    album.album.artists?.some(artist => artist.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || []
  
  return (
    <SpotifyStatsLayout
      title="My Top Albums"
      description={loading ? 'Loading...' : `From ${albumsData?.metadata.consolidatedTotalAlbums} different albums from the past 15 years`}
      currentPage="albums"
      additionalControls={<ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />}
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your top albums...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Search Bar */}
          <div className="relative max-w-md mx-auto mb-8">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search albums or artists..."
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
          
          {/* Albums Display */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredAlbums.map((album) => (
              <Card key={album.primaryAlbumId} className="group hover:shadow-lg transition-shadow duration-200">
                <CardContent className="p-3">
                  {/* Album Image */}
                  <div className="mb-3">
                    <LazyAlbumImage album={album.album} rank={album.rank} />
                  </div>
                  
                  {/* Album Info */}
                  <div className="space-y-2">
                    {/* Rank Badge */}
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        #{album.rank}
                      </Badge>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Play className="w-3 h-3 mr-1" />
                        {album.count}
                      </div>
                    </div>
                    
                    {/* Album Name */}
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {album.album.name}
                    </h3>
                    
                    {/* Artist Name */}
                    <button
                      onClick={() => setSearchTerm(album.album.artists[0])}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors line-clamp-1 text-left"
                    >
                      {album.album.artists[0]}
                    </button>
                    
                    {/* Duration */}
                    <p className="text-xs text-muted-foreground">
                      {(() => {
                        const duration = album.total_duration_ms || 0
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
              <div className="col-span-4">Album</div>
              <div className="col-span-3">Artist</div>
              <div className="col-span-1">Plays</div>
              <div className="col-span-2">Duration</div>
            </div>
            
            {filteredAlbums.map((album) => (
              <Card key={album.primaryAlbumId} className="group hover:shadow-lg transition-shadow duration-200">
                <CardContent className="p-3 md:p-2">
                  {/* Desktop Layout */}
                  <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                    {/* Rank */}
                    <div className="col-span-1">
                      <Badge variant="secondary" className="text-xs">
                        #{album.rank}
                      </Badge>
                    </div>
                    
                    {/* Album Image */}
                    <div className="col-span-1">
                      <div className="w-12 h-12 aspect-square">
                        <LazyAlbumImage album={album.album} rank={album.rank} />
                      </div>
                    </div>
                    
                    {/* Album Name */}
                    <div className="col-span-4">
                      <h3 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors">
                        {album.album.name}
                      </h3>
                    </div>
                    
                    {/* Artist Name */}
                    <div className="col-span-3">
                      <button
                        onClick={() => setSearchTerm(album.album.artists[0])}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors text-left"
                      >
                        {album.album.artists[0]}
                      </button>
                    </div>
                    
                    {/* Play Count */}
                    <div className="col-span-1">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Play className="w-3 h-3 mr-1" />
                        {album.count}
                      </div>
                    </div>
                    
                    {/* Duration */}
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">
                        {(() => {
                          const totalMinutes = Math.floor(album.total_duration_ms / 60000)
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
                      <LazyAlbumImage album={album.album} rank={album.rank} size="mobile" />
                    </div>
                    
                    {/* Album Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="secondary" className="text-xs">
                          #{album.rank}
                        </Badge>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Play className="w-3 h-3 mr-1" />
                          {album.count}
                        </div>
                      </div>
                      
                      <h3 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors mb-1">
                        {album.album.name}
                      </h3>
                      
                      <button
                        onClick={() => setSearchTerm(album.album.artists[0])}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors text-left mb-1"
                      >
                        {album.album.artists[0]}
                      </button>
                      
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          const totalMinutes = Math.floor(album.total_duration_ms / 60000)
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
        
          {filteredAlbums.length === 0 && searchTerm && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No albums found matching &quot;{searchTerm}&quot;</p>
            </div>
          )}
        </>
      )}
    </SpotifyStatsLayout>
  )
}
