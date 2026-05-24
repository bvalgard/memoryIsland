import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface ActivityHeatmapProps {
  dailyActivityMap: Record<string, number>;
  dailyStreak: number;
  longestDailyStreak: number;
  lastStudyDate: string;
}

const WEEKS_VISIBLE = 17;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toDateString(d: Date) {
  return d.toISOString().split('T')[0];
}

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function getCellColor(count: number): string {
  if (count === 0) return 'bg-white/8';
  if (count <= 5) return 'bg-teal-900';
  if (count <= 15) return 'bg-teal-700';
  if (count <= 30) return 'bg-teal-500';
  return 'bg-teal-300';
}

function buildStreakSet(lastStudyDate: string, dailyStreak: number): Set<string> {
  const streakDates = new Set<string>();
  if (dailyStreak <= 0 || !lastStudyDate) return streakDates;
  let cursor = new Date(lastStudyDate + 'T12:00:00');
  for (let i = 0; i < dailyStreak; i++) {
    streakDates.add(toDateString(cursor));
    cursor = addDays(cursor, -1);
  }
  return streakDates;
}

export default function ActivityHeatmap({
  dailyActivityMap,
  dailyStreak,
  longestDailyStreak,
  lastStudyDate,
}: ActivityHeatmapProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  // End of display window: end of the week containing today, shifted by weekOffset
  const endSunday = new Date(today);
  endSunday.setDate(today.getDate() - today.getDay() + 6 + weekOffset * 7);

  // Start: WEEKS_VISIBLE weeks back from the Sunday before endSunday+1
  const startSunday = new Date(endSunday);
  startSunday.setDate(endSunday.getDate() - (WEEKS_VISIBLE * 7 - 1));
  // Snap startSunday to the nearest Sunday
  startSunday.setDate(startSunday.getDate() - startSunday.getDay());

  // Build columns: each column is an array of date strings (Sun–Sat)
  const columns: { dates: (string | null)[]; monthLabel?: string }[] = [];
  let cursor = new Date(startSunday);

  for (let w = 0; w < WEEKS_VISIBLE; w++) {
    const weekDates: (string | null)[] = [];
    let monthLabel: string | undefined;
    for (let d = 0; d < 7; d++) {
      const dateStr = toDateString(cursor);
      const isFuture = cursor > today;
      weekDates.push(isFuture ? null : dateStr);
      // Month label on the first day of the month, shown at the top of the column
      if (d === 0 || (cursor.getDate() === 1)) {
        if (d === 0 && cursor.getDate() <= 7) {
          monthLabel = MONTH_NAMES[cursor.getMonth()];
        } else if (cursor.getDate() === 1) {
          monthLabel = MONTH_NAMES[cursor.getMonth()];
        }
      }
      cursor = addDays(cursor, 1);
    }
    columns.push({ dates: weekDates, monthLabel });
  }

  const streakSet = buildStreakSet(lastStudyDate, dailyStreak);
  const canGoRight = weekOffset < 0;

  return (
    <div className="p-4 rounded-2xl bg-white/5 border border-white/8 select-none">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-white">{dailyStreak}</span>
          <span className="text-base font-semibold text-white/80">day streak</span>
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">
          Longest Streak&nbsp;|&nbsp;
          <span className="text-white/70">{longestDailyStreak} days</span>
        </div>
      </div>

      {/* Navigation + Grid */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setWeekOffset((o) => o - 4)}
          className="p-1 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/8 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 overflow-hidden">
          {/* Month labels row */}
          <div className="flex mb-1 pl-8">
            {columns.map((col, i) => (
              <div key={i} className="flex-1 text-[10px] text-white/40 font-medium text-center truncate">
                {col.monthLabel ?? ''}
              </div>
            ))}
          </div>

          {/* Day labels + cell grid */}
          <div className="flex gap-0.5">
            {/* Day-of-week labels */}
            <div className="flex flex-col gap-0.5 mr-1 w-7 shrink-0">
              {DAY_LABELS.map((label, i) => (
                <div key={label} className={cn(
                  "h-3 text-[9px] text-white/30 flex items-center justify-end pr-0.5 leading-none",
                  i % 2 === 1 ? 'opacity-100' : 'opacity-0'
                )}>
                  {label}
                </div>
              ))}
            </div>

            {/* Week columns */}
            {columns.map((col, wi) => (
              <div key={wi} className="flex flex-col gap-0.5 flex-1">
                {col.dates.map((dateStr, di) => {
                  if (dateStr === null) {
                    return <div key={di} className="h-3 rounded-[2px] bg-transparent" />;
                  }
                  const count = dailyActivityMap[dateStr] ?? 0;
                  const isStreakCell = streakSet.has(dateStr);
                  const isToday = dateStr === toDateString(today);
                  return (
                    <div
                      key={di}
                      title={`${dateStr}: ${count} card${count !== 1 ? 's' : ''}`}
                      className={cn(
                        'h-3 rounded-[2px] transition-all',
                        getCellColor(count),
                        isStreakCell && 'ring-1 ring-amber-400/80 ring-inset',
                        isToday && !isStreakCell && 'ring-1 ring-white/30 ring-inset',
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => setWeekOffset((o) => o + 4)}
          disabled={!canGoRight}
          className="p-1 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/8 transition-colors disabled:opacity-20 disabled:cursor-default"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5 text-[10px] text-white/30">
          <span>More</span>
          <div className="w-2.5 h-2.5 rounded-[2px] bg-teal-300" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-teal-500" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-teal-700" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-teal-900" />
          <span>Less</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-white/30">
          <div className="w-2.5 h-2.5 rounded-[2px] bg-white/8 ring-1 ring-amber-400/80 ring-inset" />
          <span>Current streak</span>
        </div>
      </div>
    </div>
  );
}
