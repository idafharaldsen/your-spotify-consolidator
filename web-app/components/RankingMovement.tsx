'use client'

import { ArrowUp, ArrowDown, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface RankingMovementProps {
  currentRank: number
  rank30DaysAgo?: number
  currentCount: number
  count30DaysAgo?: number
  size?: 'sm' | 'md'
}

export default function RankingMovement({
  currentRank,
  rank30DaysAgo,
  currentCount,
  count30DaysAgo,
  size = 'md'
}: RankingMovementProps) {
  // Calculate rank change
  const rankChange = rank30DaysAgo !== undefined 
    ? rank30DaysAgo - currentRank // positive = moved up, negative = moved down
    : null
  
  // Calculate play count change
  const playsAdded = count30DaysAgo !== undefined
    ? currentCount - count30DaysAgo
    : null
  
  // Determine if it's a new entry
  const isNewEntry = rank30DaysAgo === undefined && currentRank <= 500

  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Rank Movement */}
      {rankChange !== null && rankChange !== 0 && (
        <Badge 
          variant={rankChange > 0 ? 'default' : 'destructive'}
          className={`${textSize} font-medium flex items-center gap-1`}
        >
          {rankChange > 0 ? (
            <ArrowUp className={iconSize} />
          ) : (
            <ArrowDown className={iconSize} />
          )}
          {Math.abs(rankChange)}
        </Badge>
      )}
      
      {/* New Entry Indicator */}
      {isNewEntry && (
        <Badge 
          variant="default"
          className={`${textSize} font-medium flex items-center gap-1 bg-green-600 hover:bg-green-700`}
        >
          <Plus className={iconSize} />
          NEW
        </Badge>
      )}
      
      {/* Plays Added */}
      {playsAdded !== null && playsAdded > 0 && (
        <Badge 
          variant="outline"
          className={`${textSize} font-medium flex items-center gap-1 text-green-600 border-green-600`}
        >
          <Plus className={iconSize} />
          {playsAdded}
        </Badge>
      )}
    </div>
  )
}
