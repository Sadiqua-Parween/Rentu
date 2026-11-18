import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, ChevronDown } from 'lucide-react';
import { formatTime12 } from '../lib/formatters';

export { formatTime12 };

export interface BookedDateRange {
  id?: string;
  start_date: string; // 'YYYY-MM-DD'
  end_date: string;   // 'YYYY-MM-DD'
  status?: string;
}

interface RentalCalendarProps {
  bookedDates: BookedDateRange[];
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
  startTime?: string;
  endTime?: string;
  onSelectRange: (start: string, end: string) => void;
  onSelectStartTime?: (time: string) => void;
  onSelectEndTime?: (time: string) => void;
  minDate?: string;
}

export const toDateString = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateString = (str: string): Date => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const TIME_SLOTS: string[] = [];
for (let h = 6; h <= 23; h++) {
  const hh = String(h).padStart(2, '0');
  TIME_SLOTS.push(`${hh}:00`);
  TIME_SLOTS.push(`${hh}:30`);
}

export const RentalCalendar: React.FC<RentalCalendarProps> = ({
  bookedDates = [],
  startDate,
  endDate,
  startTime = '10:00',
  endTime = '18:00',
  onSelectRange,
  onSelectStartTime,
  onSelectEndTime,
  minDate,
}) => {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayStr = useMemo(() => toDateString(today), [today]);

  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (startDate) {
      const d = parseDateString(startDate);
      if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [rangeError, setRangeError] = useState<string>('');
  const [isSelectingEnd, setIsSelectingEnd] = useState<boolean>(false);

  const prevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setRangeError('');
  };

  const nextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setRangeError('');
  };

  const canGoPrev = useMemo(() => {
    const firstOfCurrent = new Date(today.getFullYear(), today.getMonth(), 1);
    return currentMonth.getTime() > firstOfCurrent.getTime();
  }, [currentMonth, today]);

  const normalizedBookedRanges = useMemo(() => {
    return (bookedDates || [])
      .map((b) => ({
        start: String(b?.start_date || '').slice(0, 10),
        end: String(b?.end_date || b?.start_date || '').slice(0, 10),
      }))
      .filter((b) => {
        return (
          b.start.length === 10 &&
          b.end.length === 10 &&
          /^\d{4}-\d{2}-\d{2}$/.test(b.start) &&
          /^\d{4}-\d{2}-\d{2}$/.test(b.end) &&
          b.end >= todayStr &&
          b.start <= b.end
        );
      });
  }, [bookedDates, todayStr]);

  const isDateBooked = (dateStr: string): boolean => {
    if (!dateStr || dateStr.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    return normalizedBookedRanges.some((range) => {
      return dateStr >= range.start && dateStr <= range.end;
    });
  };

  const hasBookedDateInRange = (startStr: string, endStr: string): boolean => {
    if (!startStr || !endStr) return false;
    return normalizedBookedRanges.some((range) => {
      return range.start <= endStr && range.end >= startStr;
    });
  };

  // Auto-advance times if needed
  React.useEffect(() => {
    if (!onSelectStartTime) return;
    const now = new Date();
    const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (startDate === todayStr && startTime <= currentHourMin) {
      const nextAvailable = TIME_SLOTS.find((s) => s > currentHourMin);
      if (nextAvailable) {
        onSelectStartTime(nextAvailable);
      }
    }
  }, [startDate, todayStr, startTime, onSelectStartTime]);

  React.useEffect(() => {
    if (!onSelectEndTime) return;
    const now = new Date();
    const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const isPastToday = endDate === todayStr && endTime <= currentHourMin;
    const isBeforeStart = startDate === endDate && endTime <= startTime;
    if (isPastToday || isBeforeStart) {
      const minSlot = startDate === endDate ? startTime : (endDate === todayStr ? currentHourMin : '00:00');
      const nextAvailable = TIME_SLOTS.find((s) => s > minSlot);
      if (nextAvailable) {
        onSelectEndTime(nextAvailable);
      }
    }
  }, [startDate, endDate, todayStr, startTime, endTime, onSelectEndTime]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isPast: boolean;
      isBooked: boolean;
      isSelectedStart: boolean;
      isSelectedEnd: boolean;
      isInRange: boolean;
    }> = [];

    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        dateStr: '',
        dayNum: 0,
        isCurrentMonth: false,
        isPast: true,
        isBooked: false,
        isSelectedStart: false,
        isSelectedEnd: false,
        isInRange: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dateStr = toDateString(d);
      const isPast = dateStr < todayStr || (minDate ? dateStr < minDate : false);
      const isBooked = isDateBooked(dateStr);
      const isSelectedStart = startDate === dateStr;
      const isSelectedEnd = endDate === dateStr;
      const isInRange = Boolean(startDate && endDate && dateStr > startDate && dateStr < endDate);

      days.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: true,
        isPast,
        isBooked,
        isSelectedStart,
        isSelectedEnd,
        isInRange,
      });
    }

    return days;
  }, [currentMonth, todayStr, minDate, startDate, endDate, normalizedBookedRanges]);

  const handleDateClick = (dateStr: string, isPast: boolean, isBooked: boolean) => {
    if (isPast || isBooked) return;
    setRangeError('');

    if (!isSelectingEnd || !startDate) {
      onSelectRange(dateStr, dateStr);
      setIsSelectingEnd(true);
    } else {
      if (dateStr < startDate) {
        onSelectRange(dateStr, dateStr);
        setIsSelectingEnd(true);
      } else {
        if (hasBookedDateInRange(startDate, dateStr)) {
          setRangeError('This range includes dates when the item is already rented.');
          return;
        }
        onSelectRange(startDate, dateStr);
        setIsSelectingEnd(false);
      }
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const isStartToday = startDate === todayStr;
  const isEndToday = endDate === todayStr;
  const now = new Date();
  const currentHourNum = now.getHours();
  const currentMinNum = now.getMinutes();
  const currentTimeStr = `${String(currentHourNum).padStart(2, '0')}:${String(currentMinNum).padStart(2, '0')}`;

  const availableStartSlots = TIME_SLOTS.filter((t) => {
    if (isStartToday) return t > currentTimeStr;
    return true;
  });

  const availableEndSlots = TIME_SLOTS.filter((t) => {
    if (isEndToday && t <= currentTimeStr) return false;
    if (startDate === endDate && t <= startTime) return false;
    return true;
  });

  const isStartTimePassedToday = isStartToday && startTime <= currentTimeStr;
  const isEndTimePassedToday = isEndToday && endTime <= currentTimeStr;

  return (
    <div className="bg-surface rounded-2xl border border-divider p-4 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-divider">
        <h4 className="text-xs sm:text-sm font-bold text-ink">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h4>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            disabled={!canGoPrev}
            className="p-1.5 rounded-lg border border-divider hover:bg-canvas text-ink transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 rounded-lg border border-divider hover:bg-canvas text-ink transition-colors cursor-pointer"
            aria-label="Next month"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w, idx) => (
          <div key={idx} className="text-[11px] font-medium text-ink-secondary py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {calendarDays.map((d, index) => {
          if (!d.isCurrentMonth) {
            return <div key={index} className="h-8.5" />;
          }

          const isClickable = !d.isPast && !d.isBooked;

          let cellStyle = 'bg-canvas text-ink hover:bg-brand-soft/30 hover:text-brand rounded-xl font-medium';

          if (d.isPast) {
            cellStyle = 'opacity-30 text-ink-secondary cursor-not-allowed bg-transparent font-normal';
          } else if (d.isBooked) {
            cellStyle = 'bg-rose-500/10 text-rose-500 font-normal line-through cursor-not-allowed rounded-xl';
          } else if (d.isSelectedStart && d.isSelectedEnd) {
            cellStyle = 'bg-brand text-white font-bold rounded-xl shadow-xs';
          } else if (d.isSelectedStart) {
            cellStyle = 'bg-brand text-white font-bold rounded-l-xl rounded-r-none shadow-xs';
          } else if (d.isSelectedEnd) {
            cellStyle = 'bg-brand text-white font-bold rounded-r-xl rounded-l-none shadow-xs';
          } else if (d.isInRange) {
            cellStyle = 'bg-brand/15 text-brand font-semibold rounded-none';
          }

          return (
            <button
              key={d.dateStr}
              type="button"
              onClick={() => handleDateClick(d.dateStr, d.isPast, d.isBooked)}
              disabled={!isClickable}
              className={`h-8.5 text-xs flex items-center justify-center transition-all cursor-pointer ${cellStyle}`}
            >
              <span>{d.dayNum}</span>
            </button>
          );
        })}
      </div>

      {/* Error */}
      {rangeError && (
        <div className="mt-2.5 p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-medium flex items-center gap-1.5 animate-in fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{rangeError}</span>
        </div>
      )}

      {/* Subtle Legend */}
      <div className="mt-3 pt-2.5 border-t border-divider flex items-center justify-between text-[11px] text-ink-secondary">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand" />
            <span>Selected</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span>Booked</span>
          </span>
        </div>

        {isSelectingEnd && (
          <span className="text-brand font-semibold text-xs">
            Pick return date →
          </span>
        )}
      </div>

      {/* Clean, Native-Styled Pickup & Return Time Selectors */}
      {(onSelectStartTime || onSelectEndTime) && (
        <div className="mt-3 pt-3 border-t border-divider grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-ink-secondary mb-1">
              Pickup time
            </label>
            <div className="relative">
              <select
                value={startTime}
                onChange={(e) => onSelectStartTime?.(e.target.value)}
                className="w-full bg-canvas border border-divider hover:border-brand/40 rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none cursor-pointer appearance-none transition-colors"
              >
                {availableStartSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {formatTime12(slot)}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-ink-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {isStartTimePassedToday && (
              <p className="text-[10px] text-rose-500 mt-1">Time has passed</p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-ink-secondary mb-1">
              Return time
            </label>
            <div className="relative">
              <select
                value={endTime}
                onChange={(e) => onSelectEndTime?.(e.target.value)}
                className="w-full bg-canvas border border-divider hover:border-brand/40 rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none cursor-pointer appearance-none transition-colors"
              >
                {availableEndSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {formatTime12(slot)}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-ink-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {isEndTimePassedToday && (
              <p className="text-[10px] text-rose-500 mt-1">Time has passed</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
