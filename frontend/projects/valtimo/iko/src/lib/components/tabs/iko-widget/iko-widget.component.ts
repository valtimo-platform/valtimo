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
import {BehaviorSubject, combineLatest, filter, Observable, switchMap, tap} from 'rxjs';
import {IkoApiService, IkoTabService} from '../../../services';
import {NGXLogger} from 'ngx-logger';
import {WidgetComponentMap, WidgetContainerComponent, WidgetType} from '@valtimo/layout';
import {IkoWidgetFieldComponent} from '../../widget-field';
import {IkoWidgetCustomComponent} from '../../widget-custom';
import {IkoWidgetFormioComponent} from '../../widget-formio';
import {IkoWidgetTableComponent} from '../../widget-table';
import {IkoWidgetCollectionComponent} from '../../widget-collection';

@Component({
  templateUrl: './iko-widget.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, WidgetContainerComponent],
})
export class IkoWidgetComponent {
  public readonly dataAggregateKey$ = this.ikoTabService.dataAggregateKey$;

  private readonly _key$ = new BehaviorSubject<string>('');

  @Input() public set key(value: string) {
    this._key$.next(value);
  }
  public get key$(): Observable<string> {
    return this._key$.pipe(filter((key: string) => !!key));
  }

  public readonly loading$ = new BehaviorSubject<boolean>(true);

  public readonly widgets$ = combineLatest([this.dataAggregateKey$, this.key$]).pipe(
    switchMap(([dataAggregateKey, key]) =>
      this.ikoApiService.getWidgetsForTab(dataAggregateKey, key)
    ),
    tap(widgets => {
      this.logger.debug(`IKO widgets retrieved ${JSON.stringify(widgets)}`);
    }),
    tap(() => this.loading$.next(false))
  );

  public readonly widgetComponentMap: WidgetComponentMap = {
    [WidgetType.FIELDS]: IkoWidgetFieldComponent,
    [WidgetType.CUSTOM]: IkoWidgetCustomComponent,
    [WidgetType.FORMIO]: IkoWidgetFormioComponent,
    [WidgetType.TABLE]: IkoWidgetTableComponent,
    [WidgetType.COLLECTION]: IkoWidgetCollectionComponent,
  };

  constructor(
    private readonly ikoTabService: IkoTabService,
    private readonly ikoApiService: IkoApiService,
    private readonly logger: NGXLogger
  ) {}
}
