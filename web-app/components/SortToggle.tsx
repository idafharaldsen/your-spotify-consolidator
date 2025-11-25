'use client'

import { ArrowUpDown } from 'lucide-react'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

export type SortOption = 'plays' | 'duration' | 'songs'

interface SortOptionConfig {
  value: SortOption
  label: string
}

interface SortToggleProps {
  sortBy: SortOption
  onSortChange: (sort: SortOption) => void
  options?: SortOptionConfig[]
}

const defaultOptions: SortOptionConfig[] = [
  { value: 'plays', label: 'Total Plays' },
  { value: 'duration', label: 'Total Duration' },
  { value: 'songs', label: 'Different Songs' },
]

export default function SortToggle({ sortBy, onSortChange, options = defaultOptions }: SortToggleProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <ArrowUpDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuRadioGroup value={sortBy} onValueChange={(value) => onSortChange(value as SortOption)}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

