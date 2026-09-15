import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { EMPTY_WEEK, type SettingsSnapshot } from '../schedule/models';
import { ScheduleStore } from '../schedule/schedule-store';
import { SETTINGS_SYNC_BACKEND_FACTORY, type SettingsSyncBackend } from './settings-sync-backend';
import { SettingsSync } from './settings-sync';

class FakeBackend implements SettingsSyncBackend {
  uid: string | null = 'user-1';
  cloud: SettingsSnapshot | null = null;
  writes: SettingsSnapshot[] = [];
  private listener: ((snapshot: SettingsSnapshot | null) => void) | undefined;

  async currentUid(): Promise<string | null> {
    return this.uid;
  }

  async signIn(): Promise<string> {
    this.uid = 'user-1';
    return this.uid;
  }

  async read(): Promise<SettingsSnapshot | null> {
    return this.cloud;
  }

  listen(
    _uid: string,
    next: (snapshot: SettingsSnapshot | null) => void,
    _error: (error: Error) => void,
  ): () => void {
    this.listener = next;
    return () => {
      this.listener = undefined;
    };
  }

  async write(_uid: string, snapshot: SettingsSnapshot): Promise<void> {
    this.writes.push(structuredClone(snapshot));
    this.cloud = structuredClone(snapshot);
  }

  async signOut(): Promise<void> {
    this.uid = null;
  }

  emit(snapshot: SettingsSnapshot): void {
    this.cloud = structuredClone(snapshot);
    this.listener?.(structuredClone(snapshot));
  }
}

function snapshot(course: string): SettingsSnapshot {
  return {
    schemaVersion: 1,
    course,
    filter: { group: false, qdl: false, groupLetter: '' },
    savedEvents: EMPTY_WEEK(),
  };
}

describe('SettingsSync', () => {
  let backend: FakeBackend;
  let factory: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('course', 'LOCAL 1');
    backend = new FakeBackend();
    factory = vi.fn(async () => backend);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SETTINGS_SYNC_BACKEND_FACTORY, useValue: factory },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not load the Firebase backend before opt-in', () => {
    TestBed.inject(SettingsSync);
    TestBed.tick();

    expect(factory).not.toHaveBeenCalled();
  });

  it('uses an existing cloud snapshot on first sign-in', async () => {
    backend.cloud = snapshot('CLOUD 2');
    const sync = TestBed.inject(SettingsSync);
    const store = TestBed.inject(ScheduleStore);

    await sync.signIn();
    TestBed.tick();

    expect(store.course()).toBe('CLOUD 2');
    expect(localStorage.getItem('course')).toBe('CLOUD 2');
    expect(backend.writes).toHaveLength(0);
    expect(sync.status()).toBe('syncing');
  });

  it('uploads local settings when the account has no cloud snapshot', async () => {
    const sync = TestBed.inject(SettingsSync);

    await sync.signIn();

    expect(backend.writes).toEqual([snapshot('LOCAL 1')]);
  });

  it('writes local changes and applies remote changes without echoing them', async () => {
    vi.useFakeTimers();
    backend.cloud = snapshot('CLOUD 2');
    const sync = TestBed.inject(SettingsSync);
    const store = TestBed.inject(ScheduleStore);
    await sync.signIn();
    TestBed.tick();

    store.setCourse('LOCAL 3');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(250);
    expect(backend.writes.at(-1)?.course).toBe('LOCAL 3');

    const writesBeforeRemote = backend.writes.length;
    backend.emit(snapshot('REMOTE 4'));
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(250);
    expect(store.course()).toBe('REMOTE 4');
    expect(backend.writes).toHaveLength(writesBeforeRemote);
  });

  it('keeps local settings and stops updates after sign-out', async () => {
    backend.cloud = snapshot('CLOUD 2');
    const sync = TestBed.inject(SettingsSync);
    const store = TestBed.inject(ScheduleStore);
    await sync.signIn();
    await sync.signOut();

    backend.emit(snapshot('REMOTE 5'));

    expect(store.course()).toBe('CLOUD 2');
    expect(localStorage.getItem('course')).toBe('CLOUD 2');
    expect(localStorage.getItem('settingsSyncEnabled')).toBeNull();
    expect(sync.status()).toBe('disabled');
  });
});
