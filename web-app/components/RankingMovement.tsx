'use client'

import { ArrowUp, ArrowDown, Plus, Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface RankingMovementProps {
  currentRank: number
  rank30DaysAgo?: number
  currentCount: number
  count30DaysAgo?: number
  size?: 'sm' | 'md'
  type?: 'rank' | 'playCount'
}

export default function RankingMovement({
  currentRank,
  rank30DaysAgo,
  currentCount,
  count30DaysAgo,
  size = 'md',
  type
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

  // If type is specified, render only that type
  if (type === 'rank') {
    return (
      <Badge variant="secondary" className={`${textSize} relative inline-flex w-fit`}>
        #{currentRank}
        {rankChange !== null && rankChange > 0 && (
          <span className="ml-1.5 flex items-center gap-0.5 text-green-600 font-semibold">
            <ArrowUp className={iconSize} />
            {rankChange}
          </span>
        )}
        {rankChange !== null && rankChange < 0 && (
          <span className="ml-1.5 flex items-center gap-0.5 text-white font-semibold">
            <ArrowDown className={iconSize} />
            {Math.abs(rankChange)}
          </span>
        )}
        {isNewEntry && (
          <span className="ml-1.5 flex items-center gap-0.5 text-green-600 font-semibold">
            <Plus className={iconSize} />
            NEW
          </span>
        )}
      </Badge>
    )
  }

  if (type === 'playCount') {
    return (
      <div className={`flex items-center ${textSize} text-muted-foreground`}>
        <Play className={`${iconSize} mr-1`} />
        <span>{currentCount}</span>
        {playsAdded !== null && playsAdded > 0 && (
          <span className="ml-1.5 flex items-center gap-0.5 text-green-600 font-semibold">
            <Plus className={iconSize} />
            {playsAdded}
          </span>
        )}
      </div>
    )
  }

  // Default: return rank badge (for backward compatibility)
  return (
    <Badge variant="secondary" className={`${textSize} relative inline-flex w-fit`}>
      #{currentRank}
      {rankChange !== null && rankChange > 0 && (
        <span className="ml-1.5 flex items-center gap-0.5 text-green-600 font-semibold">
          <ArrowUp className={iconSize} />
          {rankChange}
        </span>
      )}
      {rankChange !== null && rankChange < 0 && (
        <span className="ml-1.5 flex items-center gap-0.5 text-white font-semibold">
          <ArrowDown className={iconSize} />
          {Math.abs(rankChange)}
        </span>
      )}
      {isNewEntry && (
        <span className="ml-1.5 flex items-center gap-0.5 text-green-600 font-semibold">
          <Plus className={iconSize} />
          NEW
        </span>
      )}
    </Badge>
  )
}
