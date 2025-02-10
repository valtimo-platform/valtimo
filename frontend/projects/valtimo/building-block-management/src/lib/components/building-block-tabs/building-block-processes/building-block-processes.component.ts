import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';

@Component({
  selector: 'valtimo-building-block-processes',
  templateUrl: './building-block-processes.component.html',
  styleUrl: './building-block-processes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
})
export class BuildingBlockProcessesComponent {}
