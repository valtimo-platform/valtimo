import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';

@Component({
  selector: 'valtimo-building-block-cases',
  templateUrl: './building-block-cases.component.html',
  styleUrl: './building-block-cases.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
})
export class BuildingBlockCasesComponent {}
