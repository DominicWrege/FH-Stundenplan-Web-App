import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-impressum',
  templateUrl: './impressum.html',
  styleUrl: './impressum.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule],
})
export class Impressum {
  readonly close = output<void>();
}
