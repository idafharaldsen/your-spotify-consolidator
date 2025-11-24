'use client'

import { LayoutGrid, List } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

interface ViewToggleProps {
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
}

export default function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center border border-input rounded-md bg-background p-1">
      <Button
        variant={viewMode === 'grid' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewModeChange('grid')}
        className={cn(
          'h-8 px-3',
          viewMode === 'grid' && 'bg-primary text-primary-foreground'
        )}
        aria-label="Grid view"
      >
        <LayoutGrid className="w-4 h-4" />
      </Button>
      <Button
        variant={viewMode === 'list' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewModeChange('list')}
        className={cn(
          'h-8 px-3',
          viewMode === 'list' && 'bg-primary text-primary-foreground'
        )}
        aria-label="List view"
      >
        <List className="w-4 h-4" />
      </Button>
    </div>
  )
}

