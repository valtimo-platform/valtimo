/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {CarbonListModule, EllipsisPipe} from '@valtimo/components';
import {ButtonModule, InputModule} from 'carbon-components-angular';
import {BehaviorSubject, of, tap} from 'rxjs';
import {FieldsWidget, WidgetFieldComponent, WidgetLayoutService} from '@valtimo/layout';

@Component({
  selector: 'valtimo-iko-widget-field',
  templateUrl: './iko-widget-field.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    InputModule,
    TranslateModule,
    CarbonListModule,
    EllipsisPipe,
    ButtonModule,
    WidgetFieldComponent,
  ],
})
export class IkoWidgetFieldComponent {
  @Input() public set widgetConfiguration(value: FieldsWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
  }

  @Input() public readonly widgetUuid: string;

  public readonly widgetConfiguration$ = new BehaviorSubject<FieldsWidget | null>(null);

  public readonly widgetData$ = of({}).pipe(
    tap(() => this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid))
  );

  constructor(private readonly widgetLayoutService: WidgetLayoutService) {}
}
