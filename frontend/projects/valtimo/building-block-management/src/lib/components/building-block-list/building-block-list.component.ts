import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: 'valtimo-building-block-list',
  templateUrl: './building-block-list.component.html',
  styleUrl: './building-block-list.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule]
})
export class BuildingBlockList {}