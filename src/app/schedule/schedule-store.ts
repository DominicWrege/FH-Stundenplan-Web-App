import { httpResource } from '@angular/common/http';
import { Injectable, computed, effect, signal } from '@angular/core';
import {
  EMPTY_WEEK,
  eventKey,
  parseCoursesResponse,
  parseEventsResponse,
  parseWeekEvents,
  type Course,
  type JsonValue,
  type MyFilter,
  type SettingsSnapshot,
  type TimetableEvent,
  type WeekEvents,
  type Weekday,
} from './models';

/** The day index shown on first load: Monday..Friday = 0..4, the weekend falls back to Monday. */
function initialDay(): number {
  const today = new Date().getDay();
  return today === 0 || today === 6 ? 0 : today - 1;
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
  readonly events = httpResource.text<WeekEvents>(
    () => {
      const url = this.feedUrl();
      return url === undefined ? undefined : { url, keepalive: true };
    },
    { defaultValue: EMPTY_WEEK(), parse: parseEventsResponse },
  );
  readonly courses = httpResource.text<Course[]>(
    () => {
      const url = this.settingsVisible()
        ? `${this.baseFeedUrl}/CourseOfStudy/${this.acceptJson}`
        : undefined;
      return url === undefined ? undefined : { url, keepalive: true };
    },
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
      return;
    }
    localStorage.setItem('course', course);
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

  settingsSnapshot(): SettingsSnapshot {
    return {
      schemaVersion: 1,
      course: this.course() ?? null,
      filter: this.filter(),
      savedEvents: this.savedEvents(),
    };
  }

  replaceSettings(snapshot: SettingsSnapshot): void {
    this.setCourse(snapshot.course ?? undefined);
    this.filter.set(snapshot.filter);
    this.savedEvents.set(snapshot.savedEvents);
  }

  private readSavedEvents(): WeekEvents {
    const raw = localStorage.getItem('savedEvents');
    if (raw === null) {
      return EMPTY_WEEK();
    }
    try {
      return parseWeekEvents(JSON.parse(raw) as JsonValue);
    } catch {
      return EMPTY_WEEK();
    }
  }
}
