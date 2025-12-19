'use client'

import { ArrowUpDown, Sparkles } from 'lucide-react'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from './ui/dropdown-menu'
import { cn } from '../lib/utils'

export type SortOption = 'plays' | 'duration' | 'songs' | 'plays_30_days' | 'release_date' | 'release_date_old' | 'first_played'

interface SortOptionConfig {
  value: SortOption
  label: string
}

interface FilterSortToggleProps {
  sortBy: SortOption
  onSortChange: (sort: SortOption) => void
  showNewOnly: boolean
  onFilterToggle: (showNewOnly: boolean) => void
  sortOptions?: SortOptionConfig[]
}

const defaultSortOptions: SortOptionConfig[] = [
  { value: 'plays', label: 'Total Plays' },
  { value: 'duration', label: 'Total Duration' },
  { value: 'songs', label: 'Different Songs' },
]

export default function FilterSortToggle({
  sortBy,
  onSortChange,
  showNewOnly,
  onFilterToggle,
  sortOptions = defaultSortOptions,
}: FilterSortToggleProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="inline-flex items-center border border-white/10 rounded-md bg-card/40 backdrop-blur-sm p-1">
          <Button 
            variant="outline" 
            size="sm"
            className={cn(
              'h-8 px-3 border-0 bg-transparent',
              showNewOnly && 'bg-primary/20 text-primary'
            )}
          >
            <ArrowUpDown className="w-4 h-4 mr-2" />
            Filter & Sort
          </Button>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Filter Section */}
        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Filter
        </DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={showNewOnly}
          onCheckedChange={onFilterToggle}
        >
          New (30d)
        </DropdownMenuCheckboxItem>
        
        <DropdownMenuSeparator />
        
        {/* Sort Section */}
        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Sort By
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={sortBy} onValueChange={(value) => onSortChange(value as SortOption)}>
          {sortOptions.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} className="pl-8">
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
