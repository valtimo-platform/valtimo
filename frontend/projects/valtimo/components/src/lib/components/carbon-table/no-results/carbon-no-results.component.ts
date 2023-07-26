import {ChangeDetectionStrategy, Component, Input, TemplateRef} from '@angular/core';

@Component({
  selector: 'valtimo-no-results',
  templateUrl: './carbon-no-results.component.html',
  styleUrls: ['./carbon-no-results.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarbonNoResultsComponent {
  @Input() action: TemplateRef<any>;
  @Input() description: string;
  @Input() illustration = 'valtimo-layout/img/no-results.svg';
  @Input() title: string;
}
