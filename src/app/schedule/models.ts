export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri';

export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Montag',
  tue: 'Dienstag',
  wed: 'Mittwoch',
  thu: 'Donnerstag',
  fri: 'Freitag',
};

export interface TimetableEvent {
  courseId: string;
  courseType: string;
  name: string;
  timeBegin: string;
  timeEnd: string;
  timestampBegin: number;
  roomId: string;
  studentSet: string;
  lecturerName: string;
}

export type WeekEvents = Record<Weekday, TimetableEvent[]>;

export interface MyFilter {
  group: boolean;
  qdl: boolean;
  groupLetter: string;
}

export interface SettingsSnapshot {
  schemaVersion: 1;
  course: string | null;
  filter: MyFilter;
  savedEvents: WeekEvents;
}

export interface Course {
  courseOfStudy: string;
  semester: string[] | null;
  name: string;
}

export function EMPTY_WEEK(): WeekEvents {
  return { mon: [], tue: [], wed: [], thu: [], fri: [] };
}

// --- strict JSON boundary (no `any`/`unknown` crosses into the domain) ---

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject;

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStoredEvent(value: JsonValue): TimetableEvent | undefined {
  if (!isJsonObject(value)) {
    return undefined;
  }
  const courseId = value['courseId'];
  const courseType = value['courseType'];
  const name = value['name'];
  const timeBegin = value['timeBegin'];
  const timeEnd = value['timeEnd'];
  const timestampBegin = value['timestampBegin'];
  const roomId = value['roomId'];
  const studentSet = value['studentSet'];
  const lecturerName = value['lecturerName'];
  if (
    typeof courseId !== 'string' ||
    typeof courseType !== 'string' ||
    typeof name !== 'string' ||
    typeof timeBegin !== 'string' ||
    typeof timeEnd !== 'string' ||
    typeof timestampBegin !== 'number' ||
    typeof roomId !== 'string' ||
    typeof studentSet !== 'string' ||
    typeof lecturerName !== 'string'
  ) {
    return undefined;
  }
  return {
    courseId,
    courseType,
    name,
    timeBegin,
    timeEnd,
    timestampBegin,
    roomId,
    studentSet,
    lecturerName,
  };
}

export function parseWeekEvents(value: JsonValue): WeekEvents {
  const week = EMPTY_WEEK();
  if (!isJsonObject(value)) {
    return week;
  }
  for (const day of WEEKDAYS) {
    const stored = value[day];
    if (!Array.isArray(stored)) {
      continue;
    }
    week[day] = stored.flatMap((entry) => {
      const event = parseStoredEvent(entry);
      return event === undefined ? [] : [event];
    });
  }
  return week;
}

function parseSyncedWeekEvents(value: JsonValue | undefined): WeekEvents | undefined {
  if (value === undefined || value === null) {
    return EMPTY_WEEK();
  }
  if (
    !isJsonObject(value) ||
    Object.keys(value).some((key) => !WEEKDAYS.includes(key as Weekday))
  ) {
    return undefined;
  }
  const week = EMPTY_WEEK();
  for (const day of WEEKDAYS) {
    const stored = value[day];
    if (stored === undefined) {
      continue;
    }
    if (!Array.isArray(stored)) {
      return undefined;
    }
    const events: TimetableEvent[] = [];
    for (const entry of stored) {
      const event = parseStoredEvent(entry);
      if (event === undefined) {
        return undefined;
      }
      events.push(event);
    }
    week[day] = events;
  }
  return week;
}

export function parseSettingsSnapshot(value: unknown): SettingsSnapshot | undefined {
  if (!isJsonObject(value) || value['schemaVersion'] !== 1) {
    return undefined;
  }
  const course = value['course'];
  const filter = value['filter'];
  const savedEvents = parseSyncedWeekEvents(value['savedEvents']);
  if (
    (course !== undefined && course !== null && typeof course !== 'string') ||
    (typeof course === 'string' && course.length > 100) ||
    !isJsonObject(filter) ||
    typeof filter['group'] !== 'boolean' ||
    typeof filter['qdl'] !== 'boolean' ||
    typeof filter['groupLetter'] !== 'string' ||
    filter['groupLetter'].length > 1 ||
    savedEvents === undefined
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    course: typeof course === 'string' ? course : null,
    filter: {
      group: filter['group'],
      qdl: filter['qdl'],
      groupLetter: filter['groupLetter'],
    },
    savedEvents,
  };
}

/**
 * Stable per-entry identity. The webservice reuses `courseId` across student-set
 * variants of the same course, so a plain courseId cannot key list items or saved picks.
 */
export function eventKey(event: TimetableEvent): string {
  return [
    event.courseId,
    event.studentSet,
    event.timeBegin,
    event.timeEnd,
    event.courseType,
    event.lecturerName,
    event.name,
  ].join('|');
}

function asString(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: JsonValue | undefined): number | undefined {
  return typeof value === 'number' ? value : undefined;
}
// --- webservice DTO mapping: https://ws.inf.fh-dortmund.de/timetable/current/rest ---

function formatTime(raw: string): string {
  // The webservice encodes "09:20" as "920" / "13:00" as "1300".
  if (raw.length < 3) {
    return raw;
  }
  return `${raw.slice(0, -2).padStart(2, '0')}:${raw.slice(-2)}`;
}

const WEEKDAY_BY_API: Record<string, Weekday> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
};

/** `GET /CourseOfStudy/?Accept=application/json` → object keyed by `sname`. */
export function parseCoursesResponse(text: string): Course[] {
  const parsed = JSON.parse(text) as JsonValue;
  if (!isJsonObject(parsed)) {
    return [];
  }
  const courses: Course[] = [];
  for (const key of Object.keys(parsed)) {
    const dto = parsed[key];
    if (!isJsonObject(dto)) {
      continue;
    }
    const grades = dto['grades'];
    const semester = Array.isArray(grades)
      ? grades
          .filter(isJsonObject)
          .map((grade) => asString(grade['grade']))
          .filter((grade): grade is string => grade !== undefined)
      : [];
    courses.push({
      courseOfStudy: asString(dto['sname']) ?? key,
      semester: semester.length > 0 ? semester : null,
      name: asString(dto['name']) ?? asString(dto['sname']) ?? key,
    });
  }
  return courses;
}

/** `GET /CourseOfStudy/{name}/{grade}/Events?Accept=application/json` → flat event array. */
export function parseEventsResponse(text: string): WeekEvents {
  const parsed = JSON.parse(text) as JsonValue;
  const week = EMPTY_WEEK();
  if (!Array.isArray(parsed)) {
    return week;
  }
  for (const entry of parsed) {
    if (!isJsonObject(entry)) {
      continue;
    }
    const courseId = asString(entry['courseId']);
    const courseType = asString(entry['courseType']);
    const name = asString(entry['name']);
    const timeBegin = asString(entry['timeBegin']);
    const timeEnd = asString(entry['timeEnd']);
    const timestampBegin = asNumber(entry['timestampBegin']);
    const roomId = asString(entry['roomId']);
    const studentSet = asString(entry['studentSet']);
    const lecturerName = asString(entry['lecturerName']);
    const weekday = asString(entry['weekday']);
    if (
      courseId === undefined ||
      courseType === undefined ||
      name === undefined ||
      timeBegin === undefined ||
      timeEnd === undefined ||
      timestampBegin === undefined ||
      roomId === undefined ||
      studentSet === undefined ||
      lecturerName === undefined ||
      weekday === undefined
    ) {
      continue;
    }
    const day = WEEKDAY_BY_API[weekday];
    if (day === undefined) {
      continue;
    }
    week[day].push({
      courseId,
      courseType,
      name,
      timeBegin: formatTime(timeBegin),
      timeEnd: formatTime(timeEnd),
      timestampBegin,
      roomId,
      studentSet,
      lecturerName,
    });
  }
  return week;
}

// --- filter rules (ported verbatim from the original app) ---

/** Port of the original `checkGroup`: `studentSet` is a range like `"A-P"`. */
export function checkGroup(userGroupLetter: string, rangeGroupLetter: string): boolean {
  const letters = rangeGroupLetter.split('-');
  if (rangeGroupLetter.indexOf(userGroupLetter) !== -1) {
    return true;
  }
  const second = letters[1];
  if (second === undefined) {
    return false;
  }
  const firstLetterAscii = (letters[0] ?? '').charCodeAt(0);
  const lastLetterAscii = second.substring(0, 1).charCodeAt(0);
  const userGroupLetterAscii = userGroupLetter.charCodeAt(0);
  return userGroupLetterAscii >= firstLetterAscii && userGroupLetterAscii <= lastLetterAscii;
}

/** Port of the original `feedFilter` branches. */
export function applyFilter(item: TimetableEvent, filter: MyFilter): boolean {
  if (!filter.group && !filter.qdl) {
    return item.name.indexOf('QdL') === -1;
  }
  if (filter.qdl && filter.group) {
    return checkGroup(filter.groupLetter, item.studentSet);
  }
  if (!filter.qdl && filter.group) {
    return checkGroup(filter.groupLetter, item.studentSet) && item.name.indexOf('QdL') === -1;
  }
  return true;
}
