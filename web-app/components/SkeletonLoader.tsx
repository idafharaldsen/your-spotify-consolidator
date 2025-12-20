import { Card, CardContent } from '@/components/ui/card'

// Skeleton for grid view items
export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card 
          key={i}
          className="backdrop-blur-md bg-card/70 border-white/10 shadow-md"
        >
          <CardContent className="p-3">
            {/* Album Image Skeleton */}
            <div className="mb-3">
              <div className="aspect-square bg-muted/50 rounded-lg animate-pulse" />
            </div>
            
            {/* Info Skeleton */}
            <div className="space-y-2">
              {/* Rank Badge Skeleton */}
              <div className="flex flex-col gap-1 items-start">
                <div className="h-5 w-16 bg-muted/50 rounded animate-pulse" />
                <div className="h-5 w-12 bg-muted/50 rounded animate-pulse" />
              </div>
              
              {/* Title Skeleton */}
              <div className="h-4 w-full bg-muted/50 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-muted/50 rounded animate-pulse" />
              
              {/* Artist Skeleton */}
              <div className="h-3 w-2/3 bg-muted/50 rounded animate-pulse" />
              
              {/* Album Skeleton */}
              <div className="h-3 w-4/5 bg-muted/50 rounded animate-pulse" />
              
              {/* Duration Skeleton */}
              <div className="h-3 w-1/3 bg-muted/50 rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Skeleton for list view items
export function ListSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {/* Header - Hidden on mobile */}
      <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-1 text-xs font-medium text-muted-foreground border-b">
        <div className="col-span-1">Rank</div>
        <div className="col-span-1"></div>
        <div className="col-span-3">Song</div>
        <div className="col-span-2">Artist</div>
        <div className="col-span-3">Album</div>
        <div className="col-span-1">Plays</div>
        <div className="col-span-1">Duration</div>
      </div>
      
      {Array.from({ length: count }).map((_, i) => (
        <Card 
          key={i}
          className="backdrop-blur-md bg-card/70 border-white/10 shadow-md"
        >
          <CardContent className="p-3 md:p-2">
            {/* Desktop Layout */}
            <div className="hidden md:grid grid-cols-12 gap-2 items-center">
              <div className="col-span-1">
                <div className="h-6 w-12 bg-muted/50 rounded animate-pulse" />
              </div>
              <div className="col-span-1">
                <div className="w-12 h-12 bg-muted/50 rounded animate-pulse" />
              </div>
              <div className="col-span-3 min-w-0">
                <div className="h-4 w-full bg-muted/50 rounded animate-pulse" />
              </div>
              <div className="col-span-2 min-w-0">
                <div className="h-4 w-3/4 bg-muted/50 rounded animate-pulse" />
              </div>
              <div className="col-span-3 min-w-0">
                <div className="h-4 w-4/5 bg-muted/50 rounded animate-pulse" />
              </div>
              <div className="col-span-1">
                <div className="h-4 w-10 bg-muted/50 rounded animate-pulse" />
              </div>
              <div className="col-span-1">
                <div className="h-4 w-12 bg-muted/50 rounded animate-pulse" />
              </div>
            </div>
            
            {/* Mobile Layout */}
            <div className="md:hidden flex items-center gap-3">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-muted/50 rounded-lg animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="h-5 w-12 bg-muted/50 rounded animate-pulse" />
                  <div className="h-5 w-10 bg-muted/50 rounded animate-pulse" />
                </div>
                <div className="h-4 w-full bg-muted/50 rounded animate-pulse mb-1" />
                <div className="h-4 w-3/4 bg-muted/50 rounded animate-pulse mb-1" />
                <div className="h-3 w-2/3 bg-muted/50 rounded animate-pulse mb-1" />
                <div className="h-3 w-1/3 bg-muted/50 rounded animate-pulse" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Skeleton for stats page
export function StatsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Yearly Top Items Skeleton */}
      <Card>
        <div className="p-6">
          <div className="h-6 w-64 bg-muted/50 rounded animate-pulse mb-4" />
          <div className="flex flex-wrap gap-2 mb-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 w-16 bg-muted/50 rounded animate-pulse" />
            ))}
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <div className="h-6 w-32 bg-muted/50 rounded animate-pulse mb-4" />
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="p-2 rounded-md">
                      <div className="flex items-start gap-3">
                        <div className="h-6 w-8 bg-muted/50 rounded animate-pulse flex-shrink-0" />
                        <div className="w-16 h-16 bg-muted/50 rounded-md animate-pulse flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="h-4 w-full bg-muted/50 rounded animate-pulse mb-2" />
                          <div className="h-3 w-3/4 bg-muted/50 rounded animate-pulse mb-2" />
                          <div className="flex items-center gap-3">
                            <div className="h-3 w-12 bg-muted/50 rounded animate-pulse" />
                            <div className="h-3 w-16 bg-muted/50 rounded animate-pulse" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Summary Stats Skeleton */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <div className="p-6">
              <div className="h-5 w-40 bg-muted/50 rounded animate-pulse mb-4" />
              <div className="h-8 w-24 bg-muted/50 rounded animate-pulse" />
            </div>
          </Card>
        ))}
      </div>

      {/* Charts Skeleton */}
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <div className="p-6">
            <div className="h-6 w-48 bg-muted/50 rounded animate-pulse mb-4" />
            <div className="h-96 bg-muted/50 rounded animate-pulse" />
          </div>
        </Card>
      ))}
    </div>
  )
}

