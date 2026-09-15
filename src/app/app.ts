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

  private swipeStartX = 0;
  private swipeStartY = 0;
  private swipeActive = false;
  private horizontalSwipe = false;
  private ignoreTabClickUntil = 0;

  constructor() {
    // First load without a saved feed opens the settings dialog, like the original `_firstRendered`.
    if (localStorage.getItem('course') === null) {
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

  selectDay(index: number): void {
    if (Date.now() < this.ignoreTabClickUntil) {
      return;
    }
    this.store.selectedDay.set(index);
  }

  onSwipeStart(event: TouchEvent): void {
    const touch = event.touches[0];
    if (touch === undefined) {
      return;
    }
    this.swipeActive = true;
    this.horizontalSwipe = false;
    this.swipeStartX = touch.clientX;
    this.swipeStartY = touch.clientY;
  }

  onSwipeMove(event: TouchEvent): void {
    if (!this.swipeActive) {
      return;
    }
    const touch = event.touches[0];
    if (touch === undefined) {
      return;
    }

    const dx = touch.clientX - this.swipeStartX;
    const dy = touch.clientY - this.swipeStartY;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      return;
    }
    this.horizontalSwipe = Math.abs(dx) > Math.abs(dy);
    if (this.horizontalSwipe) {
      event.preventDefault();
    }
  }

  onSwipeEnd(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    if (touch === undefined) {
      return;
    }
    this.finishSwipe(touch.clientX, touch.clientY);
  }

  onSwipeCancel(event: TouchEvent): void {
    const touch = event.changedTouches[0] ?? event.touches[0];
    if (touch !== undefined) {
      this.finishSwipe(touch.clientX, touch.clientY);
      return;
    }
    this.cancelSwipe();
  }

  private finishSwipe(endX: number, endY: number): void {
    if (!this.swipeActive) {
      return;
    }
    this.swipeActive = false;

    const dx = endX - this.swipeStartX;
    const dy = endY - this.swipeStartY;
    // Ignore short swipes and mostly-vertical gestures so scrolling still works.
    if (!this.horizontalSwipe || Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) {
      return;
    }
    this.ignoreTabClickUntil = Date.now() + 500;
    this.goToDay(this.store.selectedDay() + (dx < 0 ? 1 : -1));
  }

  cancelSwipe(): void {
    this.swipeActive = false;
    this.horizontalSwipe = false;
    this.swipeStartX = 0;
    this.swipeStartY = 0;
  }

  private goToDay(index: number): void {
    if (index < 0 || index >= this.weekdays.length) {
      return;
    }
    this.store.selectedDay.set(index);
  }
}
