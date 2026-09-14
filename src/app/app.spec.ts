import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { EMPTY_WEEK } from './schedule/models';
import { App } from './app';

const FEED_URL =
  'https://ws.inf.fh-dortmund.de/timetable/current/rest/CourseOfStudy/INFO/1/Events?Accept=application%2Fjson';
const COURSES_URL = 'https://ws.inf.fh-dortmund.de/timetable/current/rest/CourseOfStudy/?Accept=application%2Fjson';

function createApp(): { fixture: ComponentFixture<App>; element: HTMLElement; http: HttpTestingController } {
  const fixture = TestBed.createComponent(App);
  // httpResource fetches lazily on first render, so drive one CD cycle before expecting the request.
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  http.expectOne(FEED_URL).flush(EMPTY_WEEK());
  return { fixture, element: fixture.nativeElement as HTMLElement, http };
}

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('feedEventsUrl', FEED_URL);
    localStorage.setItem('course', 'INFO 1');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('renders the tab strip with today weekday active', async () => {
    const { fixture, element } = createApp();
    await fixture.whenStable();
    fixture.detectChanges();

    const tabs = Array.from(element.querySelectorAll<HTMLAnchorElement>('.mat-mdc-tab-link'));
    expect(tabs).toHaveLength(5);
    const today = new Date().getDay();
    const expected = today === 0 || today === 6 ? 0 : today - 1;
    const active = tabs[expected];
    expect(active?.classList).toContain('mdc-tab--active');
  });

  it('opens the settings modal and restores the timetable on close', async () => {
    const { fixture, element, http } = createApp();
    await fixture.whenStable();
    fixture.detectChanges();

    const settingsButton = element.querySelector<HTMLButtonElement>('[aria-label="Einstellungen"]');
    expect(settingsButton).not.toBeNull();
    settingsButton?.click();
    fixture.detectChanges();
    http.expectOne(COURSES_URL).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(document.body.querySelector('app-settings')).not.toBeNull();

    const closeButton = document.body.querySelector<HTMLButtonElement>('app-settings .close-btn');
    closeButton?.click();
    // The dialog exit animation completes via an internal timer, not a reactive signal.
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, 400);
    await promise;
    await fixture.whenStable();
    fixture.detectChanges();

    expect(document.body.querySelector('app-settings')).toBeNull();
    expect(element.querySelector('nav')).not.toBeNull();
  });
});
