import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Impressum } from '../impressum/impressum';
import { type Course } from '../schedule/models';
import { ScheduleStore } from '../schedule/schedule-store';

interface CourseOption {
  value: string;
  label: string;
}

const GROUP_LETTERS: readonly string[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

@Component({
  selector: 'app-settings',
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
    Impressum,
  ],
})
export class Settings {
  readonly store = inject(ScheduleStore);
  private readonly dialogRef = inject<MatDialogRef<Settings>>(MatDialogRef);

  readonly impressumVisible = signal(false);
  readonly groupLetters = GROUP_LETTERS;

  readonly courseOptions = computed<CourseOption[]>(() =>
    (this.store.courses.value() ?? []).flatMap((course: Course) =>
      course.semester === null
        ? [{ value: `${course.courseOfStudy} 0`, label: course.name }]
        : course.semester.map((semester) => ({
            value: `${course.courseOfStudy} ${semester}`,
            label: `${course.name} ${semester}`,
          })),
    ),
  );

  courseChanged(change: MatSelectChange): void {
    this.store.setCourse(change.value);
  }

  groupLetterChanged(change: MatSelectChange): void {
    this.store.setFilter({ ...this.store.filter(), groupLetter: change.value });
  }

  groupChanged(checked: boolean): void {
    this.store.setFilter({ ...this.store.filter(), group: checked });
  }

  qdlChanged(checked: boolean): void {
    this.store.setFilter({ ...this.store.filter(), qdl: checked });
  }

  reset(): void {
    this.store.resetSavedEvents();
    this.dialogRef.close();
  }

  close(): void {
    this.dialogRef.close();
  }
}
