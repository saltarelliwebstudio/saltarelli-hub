import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface MonthPickerProps {
  value: { month: number; year: number };
  onChange: (value: { month: number; year: number }) => void;
  className?: string;
}

export function MonthPicker({ value, onChange, className }: MonthPickerProps) {
  const [year, setYear] = useState(value.year);
  const [open, setOpen] = useState(false);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const handleSelect = (month: number) => {
    onChange({ month, year });
    setOpen(false);
  };

  const isFuture = (month: number) => {
    return year > currentYear || (year === currentYear && month > currentMonth);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('justify-start text-left font-normal', className)}>
          <Calendar className="mr-2 h-4 w-4" />
          {MONTH_NAMES[value.month]} {value.year}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3" align="start">
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setYear(y => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{year}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setYear(y => y + 1)}
            disabled={year >= currentYear}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MONTHS.map((label, i) => {
            const isSelected = i === value.month && year === value.year;
            const isCurrent = i === currentMonth && year === currentYear;
            const disabled = isFuture(i);

            return (
              <Button
                key={label}
                variant={isSelected ? 'default' : 'ghost'}
                size="sm"
                disabled={disabled}
                onClick={() => handleSelect(i)}
                className={cn(
                  'h-9',
                  isSelected && 'gradient-orange text-white',
                  isCurrent && !isSelected && 'border border-accent/40',
                )}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
