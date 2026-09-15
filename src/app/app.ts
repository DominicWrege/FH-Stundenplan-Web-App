import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { WEEKDAYS, WEEKDAY_LABELS } from './schedule/models';
import { ScheduleStore } from './schedule/schedule-store';
import { Settings } from './settings/settings';
import { Timetable } from './timetable/timetable';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatTabsModule,
    MatToolbarModule,
    Timetable,
  ],
})
export class App {
  private readonly dialog = inject(MatDialog);
  private dialogRef: MatDialogRef<unknown, Settings> | null = null;

  readonly store = inject(ScheduleStore);
  readonly weekdays = WEEKDAYS;
  readonly labels = WEEKDAY_LABELS;

  private swipePointerId: number | undefined;
  private swipeStartX = 0;
  private swipeStartY = 0;

  constructor() {
    // First load without a saved feed opens the settings dialog, like the original `_firstRendered`.
    if (localStorage.getItem('feedEventsUrl') === null) {
      this.openSettings();
    }
  }

  toggleSettings(): void {
    if (this.dialogRef !== null) {
      this.dialogRef.close();
      return;
    }
    this.openSettings();
  }

  private openSettings(): void {
    this.store.settingsVisible.set(true);
    this.dialogRef = this.dialog.open(Settings, {
      width: '85%',
      maxWidth: '720px',
      maxHeight: '90vh',
      disableClose: true,
      autoFocus: false,
    });
    this.dialogRef.afterClosed().subscribe(() => {
      this.dialogRef = null;
      this.store.settingsVisible.set(false);
    });
  }

  onSwipeStart(event: PointerEvent): void {
    if (event.pointerType !== 'touch') {
      return;
    }
    this.swipePointerId = event.pointerId;
    this.swipeStartX = event.clientX;
    this.swipeStartY = event.clientY;

    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  onSwipeEnd(event: PointerEvent): void {
    if (event.pointerId !== this.swipePointerId) {
      return;
    }
    this.swipePointerId = undefined;

    const dx = event.clientX - this.swipeStartX;
    const dy = event.clientY - this.swipeStartY;
    // Ignore short swipes and mostly-vertical gestures so scrolling still works.
    if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) {
      return;
    }
    this.goToDay(this.store.selectedDay() + (dx < 0 ? 1 : -1));
  }

  cancelSwipe(): void {
    this.swipePointerId = undefined;
  }

  private goToDay(index: number): void {
    if (index < 0 || index >= this.weekdays.length) {
      return;
    }
    this.store.selectedDay.set(index);
  }
}
