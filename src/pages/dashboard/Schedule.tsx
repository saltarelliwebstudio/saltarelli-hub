import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock } from 'lucide-react';

interface ClassSession {
  name: string;
  time: string;
  isNew?: boolean;
}

interface DaySchedule {
  day: string;
  shortDay: string;
  classes: ClassSession[];
}

const SCHEDULE: DaySchedule[] = [
  {
    day: 'Monday',
    shortDay: 'MON',
    classes: [
      { name: 'Circuit', time: '6:00 - 6:45 PM' },
      { name: 'Adv No-Gi Jiu-Jitsu', time: '7:00 - 8:30 PM' },
      { name: 'No-Gi Jiu-Jitsu Basics', time: '6:15 - 7:00 PM' },
    ],
  },
  {
    day: 'Tuesday',
    shortDay: 'TUE',
    classes: [
      { name: 'Champs Jiu-Jitsu', time: '5:00 - 5:30 PM' },
      { name: 'Kids Jiu-Jitsu', time: '5:30 - 6:15 PM' },
      { name: 'Striking Basics', time: '6:15 - 7:00 PM' },
      { name: 'Adv Striking', time: '7:00 - 8:30 PM' },
    ],
  },
  {
    day: 'Wednesday',
    shortDay: 'WED',
    classes: [
      { name: 'Circuit', time: '6:00 - 6:45 PM' },
      { name: 'Striking Basics', time: '6:15 - 7:00 PM', isNew: true },
      { name: 'Adv No-Gi Jiu-Jitsu', time: '7:00 - 8:30 PM' },
      { name: 'No-Gi Jiu-Jitsu Basics', time: '6:15 - 7:00 PM' },
    ],
  },
  {
    day: 'Thursday',
    shortDay: 'THU',
    classes: [
      { name: 'Champs Striking', time: '5:00 - 5:30 PM' },
      { name: 'Kids Striking', time: '5:30 - 6:15 PM' },
      { name: 'Striking Basics', time: '6:15 - 7:00 PM' },
      { name: 'Adv Striking', time: '7:00 - 8:00 PM' },
    ],
  },
  {
    day: 'Friday',
    shortDay: 'FRI',
    classes: [
      { name: 'Kids Competition Team', time: '6:00 - 7:00 PM' },
      { name: 'MMA (Invite Only)', time: '7:00 - 8:00 PM' },
    ],
  },
  {
    day: 'Saturday',
    shortDay: 'SAT',
    classes: [
      { name: 'Champs / Kids Jiu-Jitsu', time: '10:00 - 10:45 AM' },
      { name: 'Champs / Kids Striking', time: '10:45 - 11:15 AM' },
      { name: 'All Levels Striking', time: '11:30 AM - 12:30 PM' },
      { name: 'Sparring', time: '12:30 - 1:00 PM' },
    ],
  },
  {
    day: 'Sunday',
    shortDay: 'SUN',
    classes: [
      { name: 'Open Mat', time: '11:00 AM - 12:00 PM' },
    ],
  },
];

// Determine today's day
function getTodayIndex(): number {
  const day = new Date().getDay();
  // getDay: 0=Sun, 1=Mon, ... 6=Sat → remap to our array (Mon=0)
  return day === 0 ? 6 : day - 1;
}

export default function Schedule() {
  const todayIndex = getTodayIndex();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Class Schedule</h1>
        <p className="text-muted-foreground">Genius Fitness & MMA — Weekly Schedule</p>
      </div>

      {/* Mobile: card layout */}
      <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
        {SCHEDULE.map((day, i) => (
          <Card
            key={day.day}
            className={i === todayIndex ? 'ring-2 ring-accent' : ''}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-accent" />
                {day.day}
                {i === todayIndex && (
                  <Badge variant="default" className="ml-auto text-xs">
                    Today
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {day.classes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No classes</p>
              ) : (
                day.classes.map((cls, j) => (
                  <div
                    key={j}
                    className="flex items-start justify-between gap-2 p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate flex items-center gap-2">
                        {cls.name}
                        {cls.isNew && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            NEW
                          </Badge>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                      <Clock className="h-3 w-3" />
                      {cls.time}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: table layout */}
      <Card className="hidden lg:block overflow-x-auto">
        <CardContent className="pt-6">
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {/* Header row */}
            {SCHEDULE.map((day, i) => (
              <div
                key={day.shortDay}
                className={`p-3 text-center font-bold text-sm ${
                  i === todayIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {day.shortDay}
                {i === todayIndex && (
                  <span className="block text-[10px] font-normal">Today</span>
                )}
              </div>
            ))}

            {/* Class cells */}
            {SCHEDULE.map((day, i) => (
              <div
                key={`classes-${day.day}`}
                className={`p-2 space-y-1.5 min-h-[200px] ${
                  i === todayIndex ? 'bg-accent/5' : 'bg-card'
                }`}
              >
                {day.classes.map((cls, j) => (
                  <div
                    key={j}
                    className="p-2 rounded-md bg-muted/60 hover:bg-muted transition-colors"
                  >
                    <p className="text-xs font-semibold leading-tight flex items-center gap-1">
                      {cls.name}
                      {cls.isNew && (
                        <Badge variant="destructive" className="text-[8px] px-1 py-0 leading-tight">
                          NEW
                        </Badge>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {cls.time}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
