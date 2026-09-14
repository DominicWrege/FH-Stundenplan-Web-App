import { httpResource } from '@angular/common/http';
import { Injectable, computed, effect, signal } from '@angular/core';
import {
  EMPTY_WEEK,
  eventKey,
  isJsonObject,
  parseCoursesResponse,
  parseEventsResponse,
  type Course,
  type JsonValue,
  type MyFilter,
  type TimetableEvent,
  type WeekEvents,
  type Weekday,
  WEEKDAYS,
} from './models';

/** The day index shown on first load: Monday..Friday = 0..4, the weekend falls back to Monday. */
function initialDay(): number {
  const today = new Date().getDay();
  return today === 0 || today === 6 ? 0 : today - 1;
}

function parseDayEvents(value: JsonValue): TimetableEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const events: TimetableEvent[] = [];
  for (const entry of value) {
    if (!isJsonObject(entry)) {
      continue;
    }
    const courseId = entry['courseId'];
    const courseType = entry['courseType'];
    const name = entry['name'];
    const timeBegin = entry['timeBegin'];
    const timeEnd = entry['timeEnd'];
    const timestampBegin = entry['timestampBegin'];
    const roomId = entry['roomId'];
    const studentSet = entry['studentSet'];
    const lecturerName = entry['lecturerName'];
    if (
      typeof courseId === 'string' &&
      typeof courseType === 'string' &&
      typeof name === 'string' &&
      typeof timeBegin === 'string' &&
      typeof timeEnd === 'string' &&
      typeof timestampBegin === 'number' &&
      typeof roomId === 'string' &&
      typeof studentSet === 'string' &&
      typeof lecturerName === 'string'
    ) {
      events.push({ courseId, courseType, name, timeBegin, timeEnd, timestampBegin, roomId, studentSet, lecturerName });
    }
  }
  return events;
}

function parseWeekEvents(value: JsonValue): WeekEvents {
  const week = EMPTY_WEEK();
  if (!isJsonObject(value)) {
    return week;
  }
  for (const day of WEEKDAYS) {
    const stored = value[day];
    if (stored !== undefined) {
      week[day] = parseDayEvents(stored);
    }
  }
  return week;
}

@Injectable({ providedIn: 'root' })
export class ScheduleStore {
  private readonly baseFeedUrl = 'https://ws.inf.fh-dortmund.de/timetable/current/rest';
  private readonly acceptJson = '?Accept=application%2Fjson';

  // --- selection / navigation ---
  readonly selectedDay = signal(initialDay());
  readonly settingsVisible = signal(false);

  // --- course + data ---
  readonly course = signal(localStorage.getItem('course') ?? undefined);
  readonly feedUrl = computed(() => {
    const course = this.course();
    if (course === undefined) {
      return undefined;
    }
    const [courseOfStudy, semester] = course.split(' ');
    if (courseOfStudy === undefined || semester === undefined) {
      return undefined;
    }
    return `${this.baseFeedUrl}/CourseOfStudy/${courseOfStudy}/${semester}/Events${this.acceptJson}`;
  });
  readonly events = httpResource.text<WeekEvents>(() => this.feedUrl(), {
    defaultValue: EMPTY_WEEK(),
    parse: parseEventsResponse,
  });
  readonly courses = httpResource.text<Course[]>(
    () => (this.settingsVisible() ? `${this.baseFeedUrl}/CourseOfStudy/${this.acceptJson}` : undefined),
    { parse: parseCoursesResponse },
  );

  // --- filter (persisted) ---
  readonly filter = signal<MyFilter>({
    group: localStorage.getItem('group') === 'true',
    qdl: localStorage.getItem('qdl') === 'true',
    groupLetter: localStorage.getItem('groupLetter') ?? '',
  });

  // --- saved/pinned events (persisted) ---
  readonly savedEvents = signal<WeekEvents>(this.readSavedEvents());

  constructor() {
    effect(() => {
      localStorage.setItem('savedEvents', JSON.stringify(this.savedEvents()));
    });
    effect(() => {
      const filter = this.filter();
      localStorage.setItem('group', String(filter.group));
      localStorage.setItem('qdl', String(filter.qdl));
      localStorage.setItem('groupLetter', filter.groupLetter);
    });
  }

  setCourse(course: string | undefined): void {
    this.course.set(course);
    if (course === undefined) {
      localStorage.removeItem('course');
      localStorage.removeItem('feedEventsUrl');
      return;
    }
    localStorage.setItem('course', course);
    localStorage.setItem('feedEventsUrl', this.feedUrl() ?? '');
  }

  setFilter(filter: MyFilter): void {
    this.filter.set(filter);
  }

  /** Merge picked events into the saved week, deduped by `eventKey` (existing kept first). */
  saveEvents(weekday: Weekday, picked: readonly TimetableEvent[]): void {
    if (picked.length === 0) {
      return;
    }
    this.savedEvents.update((week) => {
      const pickedKeys = new Set(picked.map((event) => eventKey(event)));
      const kept = week[weekday].filter((event) => !pickedKeys.has(eventKey(event)));
      return { ...week, [weekday]: [...kept, ...picked] };
    });
  }

  resetSavedEvents(): void {
    this.savedEvents.set(EMPTY_WEEK());
  }

  private readSavedEvents(): WeekEvents {
    const raw = localStorage.getItem('savedEvents');
    if (raw === null) {
      return EMPTY_WEEK();
    }
    return parseWeekEvents(JSON.parse(raw) as JsonValue);
  }
}
