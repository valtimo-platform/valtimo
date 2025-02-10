import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';

@Component({
  selector: 'valtimo-building-block-decisions',
  templateUrl: './building-block-decisions.component.html',
  styleUrl: './building-block-decisions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
})
export class BuildingBlockDecisionsComponent {}
