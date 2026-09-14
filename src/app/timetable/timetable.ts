import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { ScheduleStore } from '../schedule/schedule-store';
import { applyFilter, eventKey, type TimetableEvent, type Weekday } from '../schedule/models';

@Component({
  selector: 'app-timetable',
  templateUrl: './timetable.html',
  styleUrl: './timetable.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatCardModule, MatCheckboxModule, MatDividerModule, MatIconModule],
  host: { '[class.active]': 'active()' },
})
export class Timetable {
  private readonly store = inject(ScheduleStore);
  readonly weekday = input.required<Weekday>();
  readonly active = input(false);
  readonly eventKey = eventKey;

  readonly inEditMode = signal(false);
  readonly picked = signal<ReadonlySet<string>>(new Set<string>());

  /** Edit mode always shows the full fetched list; otherwise saved events win over the fetched week. */
  readonly sourceList = computed<TimetableEvent[]>(() => {
    if (this.inEditMode()) {
      return this.store.events.value()[this.weekday()] ?? [];
    }
    const saved = this.store.savedEvents()[this.weekday()];
    return saved.length > 0 ? saved : this.store.events.value()[this.weekday()] ?? [];
  });

  readonly visible = computed(() =>
    this.sourceList()
      .filter((item) => applyFilter(item, this.store.filter()))
      .sort((a, b) => a.timestampBegin - b.timestampBegin),
  );

  togglePick(key: string, checked: boolean): void {
    this.picked.update((keys) => {
      const next = new Set(keys);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  enterEditMode(): void {
    this.picked.set(new Set(this.store.savedEvents()[this.weekday()].map((event) => eventKey(event))));
    this.inEditMode.set(true);
  }

  savePicked(): void {
    const pickedKeys = this.picked();
    this.store.saveEvents(this.weekday(), this.sourceList().filter((event) => pickedKeys.has(eventKey(event))));
    this.picked.set(new Set<string>());
    this.inEditMode.set(false);
  }
}
