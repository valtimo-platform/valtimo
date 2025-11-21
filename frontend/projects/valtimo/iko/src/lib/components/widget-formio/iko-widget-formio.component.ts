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

import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {BehaviorSubject, combineLatest, filter, Observable, of, switchMap, tap} from 'rxjs';
import {FormIoModule} from '@valtimo/components';
import {ButtonModule} from 'carbon-components-angular';
import {
  FormioWidgetWidgetWithUuid,
  WidgetFormioComponent,
  WidgetLayoutService,
} from '@valtimo/layout';
import {IkoApiService} from '../../services';
import {IkoWidgetParams} from '../../models';

// TODO: remove component, document id is required, which makes no sense for iko
@Component({
  selector: 'valtimo-iko-widget-formio',
  templateUrl: './iko-widget-formio.component.html',
  standalone: true,
  imports: [CommonModule, TranslateModule, FormIoModule, ButtonModule, WidgetFormioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IkoWidgetFormioComponent {
  @Input() public set widgetConfiguration(value: FormioWidgetWidgetWithUuid) {
    if (!value) return;
    this._widgetConfigurationSubject$.next(value);
  }

  private readonly _widgetParams$ = new BehaviorSubject<IkoWidgetParams | null>(null);
  @Input() public set widgetParams(value: IkoWidgetParams) {
    this._widgetParams$.next(value);
  }

  @Input() public readonly widgetUuid: string;

  private readonly _widgetConfigurationSubject$ =
    new BehaviorSubject<FormioWidgetWidgetWithUuid | null>(null);
  public get widgetConfiguration$(): Observable<FormioWidgetWidgetWithUuid> {
    return this._widgetConfigurationSubject$.pipe(filter(config => !!config));
  }

  public readonly widgetData$ = combineLatest([
    this.widgetConfiguration$,
    this._widgetParams$,
  ]).pipe(
    switchMap(([widgetConfiguration, widgetParams]) =>
      !widgetParams || !widgetConfiguration
        ? of(null)
        : this.ikoApiService.getIkoWidgetData(
            widgetParams.dataAggregateKey,
            widgetParams.tabKey,
            widgetConfiguration.key,
            widgetParams.entryId
          )
    ),
    tap(() => this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid))
  );

  constructor(
    private readonly ikoApiService: IkoApiService,
    private readonly widgetLayoutService: WidgetLayoutService
  ) {}
}
