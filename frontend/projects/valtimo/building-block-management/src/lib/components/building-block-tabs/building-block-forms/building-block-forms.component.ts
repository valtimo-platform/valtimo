import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';

@Component({
  selector: 'valtimo-building-block-forms',
  templateUrl: './building-block-forms.component.html',
  styleUrl: './building-block-forms.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
})
export class BuildingBlockFormsComponent {}
