import { ChangeDetectionStrategy, Component, output } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { CONTACT_EMAIL } from "./contact";

@Component({
  selector: "app-impressum",
  templateUrl: "./impressum.html",
  styleUrl: "./impressum.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule],
})
export class Impressum {
  readonly close = output<void>();
  readonly contactEmail = CONTACT_EMAIL;
}
