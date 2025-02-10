import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';

@Component({
  selector: 'valtimo-building-block-form-flows',
  templateUrl: './building-block-form-flows.component.html',
  styleUrl: './building-block-form-flows.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
})
export class BuildingBlockFormFlowsComponent {}
