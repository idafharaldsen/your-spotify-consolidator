'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Play, X, Users } from 'lucide-react'
import SpotifyStatsLayout from '../../components/SpotifyStatsLayout'
import ViewToggle from '@/components/ViewToggle'

interface ArtistImage {
  height: number
  url: string
  width: number
}

interface Artist {
  name: string
  genres: string[]
  popularity: number
  followers: {
    total: number
  }
  images: ArtistImage[]
  external_urls: {
    spotify: string
  }
}

interface ArtistData {
  duration_ms: number
  count: number
  differents: number
  primaryArtistId: string
  total_count: number
  total_duration_ms: number
  artist: Artist
  consolidated_count: number
  original_artistIds: (string | null)[]
  original_counts: number[]
  rank: number
}

interface ArtistsData {
  metadata: {
    originalTotalArtists: number
    consolidatedTotalArtists: number
    duplicatesRemoved: number
    consolidationRate: number
    timestamp: string
  }
  artists: ArtistData[]
}

// Lazy loading image component for artists
const LazyArtistImage = ({ artist, rank, size = 'default' }: { artist: Artist; rank: number; size?: 'default' | 'mobile' }) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  
  const imageUrl = artist.images[0]?.url || ''
  
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
    
    const imgRef = document.getElementById(`artist-${rank}-${size}`)
    if (imgRef) {
      observer.observe(imgRef)
    }
    
    return () => observer.disconnect()
  }, [rank, size])
  
  return (
    <div 
      id={`artist-${rank}-${size}`}
      className={`relative bg-muted rounded-full overflow-hidden ${
        size === 'mobile' ? 'w-16 h-16' : 'aspect-square'
      }`}
    >
      {isInView && (
        <Image
          src={imageUrl}
          alt={`${artist.name} artist image`}
          fill
          className={`object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setIsLoaded(true)}
          sizes={size === 'mobile' ? '64px' : "(max-width: 768px) 150px, (max-width: 1024px) 200px, 250px"}
        />
      )}
      {!isLoaded && isInView && (
        <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
          <Users className={`${size === 'mobile' ? 'w-6 h-6' : 'w-8 h-8'} text-muted-foreground`} />
        </div>
      )}
    </div>
  )
}

export default function TopArtistsPage() {
  const [artistsData, setArtistsData] = useState<ArtistsData | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  useEffect(() => {
    const fetchArtists = async () => {
      try {
        const response = await fetch('/api/data/artists', {
          cache: 'no-cache' // Validate with server but allow short-term caching
        })
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`)
        }
        const data = await response.json()
        setArtistsData(data)
      } catch (error) {
        console.error('Error fetching artists:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchArtists()
  }, [])
  
  const filteredArtists = artistsData?.artists.filter(artist => 
    artist.artist.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    artist.artist.genres?.some(genre => genre.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || []
  
  return (
    <SpotifyStatsLayout
      title="My Top Artists"
      description={loading ? 'Loading...' : `From ${artistsData?.metadata.consolidatedTotalArtists} different artists from the past 15 years`}
      currentPage="artists"
      additionalControls={<ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />}
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your top artists...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Search Bar */}
          <div className="relative max-w-md mx-auto mb-8">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search artists or genres..."
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
          
          {/* Artists Display */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredArtists.map((artist) => (
              <Card key={artist.primaryArtistId} className="group hover:shadow-lg transition-shadow duration-200">
                <CardContent className="p-3">
                  {/* Artist Image */}
                  <div className="mb-3">
                    <LazyArtistImage artist={artist.artist} rank={artist.rank} />
                  </div>
                  
                  {/* Artist Info */}
                  <div className="space-y-2">
                    {/* Rank Badge */}
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        #{artist.rank}
                      </Badge>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Play className="w-3 h-3 mr-1" />
                        {artist.count}
                      </div>
                    </div>
                    
                    {/* Artist Name */}
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {artist.artist.name}
                    </h3>
                    
                    {/* Genres */}
                    <div className="flex flex-wrap gap-1">
                      {artist.artist.genres.slice(0, 2).map((genre, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {genre}
                        </Badge>
                      ))}
                      {artist.artist.genres.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{artist.artist.genres.length - 2}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Different Songs */}
                    <p className="text-xs text-muted-foreground">
                      {artist.differents} songs
                    </p>
                    
                    {/* Duration */}
                    <p className="text-xs text-muted-foreground">
                      {(() => {
                        const duration = artist.total_duration_ms || 0
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
              <div className="col-span-3">Artist</div>
              <div className="col-span-3">Genres</div>
              <div className="col-span-1">Plays</div>
              <div className="col-span-1">Songs</div>
              <div className="col-span-2">Duration</div>
            </div>
            
            {filteredArtists.map((artist) => (
              <Card key={artist.primaryArtistId} className="group hover:shadow-lg transition-shadow duration-200">
                <CardContent className="p-3 md:p-2">
                  {/* Desktop Layout */}
                  <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                    {/* Rank */}
                    <div className="col-span-1">
                      <Badge variant="secondary" className="text-xs">
                        #{artist.rank}
                      </Badge>
                    </div>
                    
                    {/* Artist Image */}
                    <div className="col-span-1">
                      <div className="w-12 h-12 aspect-square">
                        <LazyArtistImage artist={artist.artist} rank={artist.rank} />
                      </div>
                    </div>
                    
                    {/* Artist Name */}
                    <div className="col-span-3">
                      <h3 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors">
                        {artist.artist.name}
                      </h3>
                    </div>
                    
                    {/* Genres */}
                    <div className="col-span-3">
                      <div className="flex flex-wrap gap-1">
                        {artist.artist.genres.slice(0, 2).map((genre, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {genre}
                          </Badge>
                        ))}
                        {artist.artist.genres.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{artist.artist.genres.length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Play Count */}
                    <div className="col-span-1">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Play className="w-3 h-3 mr-1" />
                        {artist.count}
                      </div>
                    </div>
                    
                    {/* Different Songs */}
                    <div className="col-span-1">
                      <p className="text-sm text-muted-foreground">
                        {artist.differents}
                      </p>
                    </div>
                    
                    {/* Duration */}
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">
                        {(() => {
                          const totalMinutes = Math.floor(artist.total_duration_ms / 60000)
                          const hours = Math.floor(totalMinutes / 60)
                          const minutes = totalMinutes % 60
                          return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
                        })()}
                      </p>
                    </div>
                  </div>
                  
                  {/* Mobile Layout */}
                  <div className="md:hidden flex items-center gap-3">
                    {/* Artist Image */}
                    <div className="flex-shrink-0">
                      <LazyArtistImage artist={artist.artist} rank={artist.rank} size="mobile" />
                    </div>
                    
                    {/* Artist Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="secondary" className="text-xs">
                          #{artist.rank}
                        </Badge>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Play className="w-3 h-3 mr-1" />
                          {artist.count}
                        </div>
                      </div>
                      
                      <h3 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors mb-1">
                        {artist.artist.name}
                      </h3>
                      
                      <div className="flex flex-wrap gap-1 mb-1">
                        {artist.artist.genres.slice(0, 2).map((genre, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {genre}
                          </Badge>
                        ))}
                        {artist.artist.genres.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{artist.artist.genres.length - 2}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{artist.differents} songs</span>
                        <span>
                          {(() => {
                            const totalMinutes = Math.floor(artist.total_duration_ms / 60000)
                            const hours = Math.floor(totalMinutes / 60)
                            const minutes = totalMinutes % 60
                            return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
          {filteredArtists.length === 0 && searchTerm && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No artists found matching &quot;{searchTerm}&quot;</p>
            </div>
          )}
        </>
      )}
    </SpotifyStatsLayout>
  )
}
