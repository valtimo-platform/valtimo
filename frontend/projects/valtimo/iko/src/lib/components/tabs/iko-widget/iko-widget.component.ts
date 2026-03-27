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
import {FitPageDirective} from '@valtimo/components';
import {
  WidgetComponentMap,
  WidgetContainerComponent,
  WidgetProgressComponent,
  WidgetType,
} from '@valtimo/layout';
import {NGXLogger} from 'ngx-logger';
import {BehaviorSubject, combineLatest, filter, map, Observable, switchMap, tap} from 'rxjs';
import {IkoWidgetParams} from '../../../models';
import {IkoApiService, IkoTabService} from '../../../services';
import {IkoWidgetCollectionComponent} from '../../widget-collection';
import {IkoWidgetCustomComponent} from '../../widget-custom';
import {IkoWidgetFieldComponent} from '../../widget-field';
import {IkoWidgetFormioComponent} from '../../widget-formio';
import {IkoWidgetInteractiveTableComponent} from '../../widget-interactive-table';
import {IkoWidgetTableComponent} from '../../widget-table';
import {IkoWidgetMapComponent} from '../../widget-map';

@Component({
  templateUrl: './iko-widget.component.html',
  styleUrl: './iko-widget.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, WidgetContainerComponent, FitPageDirective],
})
export class IkoWidgetComponent {
  public readonly ikoViewKey$ = this.ikoTabService.ikoViewKey$;
  public readonly entryId$ = this.ikoTabService.entryId$;

  private readonly _key$ = new BehaviorSubject<string>('');

  @Input() public set key(value: string) {
    this._key$.next(value);
  }
  public get key$(): Observable<string> {
    return this._key$.pipe(filter((key: string) => !!key));
  }

  public readonly loading$ = new BehaviorSubject<boolean>(true);

  public widgets$ = combineLatest([this.ikoViewKey$, this.key$]).pipe(
    switchMap(([ikoViewKey, key]) => this.ikoApiService.getIkoWidget(ikoViewKey, key))
  );
  public widgetParams$: Observable<IkoWidgetParams> = combineLatest([
    this.ikoViewKey$,
    this.key$,
    this.entryId$,
  ]).pipe(
    map(([ikoViewKey, tabKey, entryId]) => ({
      ikoViewKey,
      entryId,
      tabKey,
    })),
    tap(widgets => {
      this.logger.debug(`IKO widgets retrieved ${JSON.stringify(widgets)}`);
      this.loading$.next(false);
    })
  );

  public readonly widgetComponentMap: WidgetComponentMap = {
    [WidgetType.FIELDS]: IkoWidgetFieldComponent,
    [WidgetType.CUSTOM]: IkoWidgetCustomComponent,
    [WidgetType.FORMIO]: IkoWidgetFormioComponent,
    [WidgetType.TABLE]: IkoWidgetTableComponent,
    [WidgetType.INTERACTIVE_TABLE]: IkoWidgetInteractiveTableComponent,
    [WidgetType.COLLECTION]: IkoWidgetCollectionComponent,
    [WidgetType.MAP]: IkoWidgetMapComponent,
    [WidgetType.PROGRESS]: WidgetProgressComponent,
  };

  constructor(
    private readonly ikoTabService: IkoTabService,
    private readonly ikoApiService: IkoApiService,
    private readonly logger: NGXLogger
  ) {}
}
