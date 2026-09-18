/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
import {FitPageDirective, WidgetLayout} from '@valtimo/components';
import {
  BasicWidget,
  WidgetComponentMap,
  WidgetContainerComponent,
  WidgetDataGroupService,
  WidgetType,
} from '@valtimo/layout';
import {NGXLogger} from 'ngx-logger';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  switchMap,
  tap,
} from 'rxjs';
import {IkoWidgetParams} from '../../../models';
import {IkoApiService, IkoTabService} from '../../../services';
import {IkoWidgetCollectionComponent} from '../../widget-collection';
import {IkoWidgetCustomComponent} from '../../widget-custom';
import {IkoWidgetFieldComponent} from '../../widget-field';
import {IkoWidgetFormioComponent} from '../../widget-formio';
import {IkoWidgetInteractiveTableComponent} from '../../widget-interactive-table';
import {IkoWidgetTableComponent} from '../../widget-table';
import {IkoWidgetMapComponent} from '../../widget-map';
import {IkoWidgetMetrolineComponent} from '../../widget-metroline';

@Component({
  templateUrl: './iko-widget.component.html',
  styleUrl: './iko-widget.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, WidgetContainerComponent, FitPageDirective],
  providers: [WidgetDataGroupService],
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

  private readonly _context$: Observable<[string, string, string]> = combineLatest([
    this.ikoViewKey$,
    this.key$,
    this.entryId$,
  ]).pipe(
    distinctUntilChanged(
      ([viewA, tabA, idA], [viewB, tabB, idB]) => viewA === viewB && tabA === tabB && idA === idB
    )
  );

  // Source and widget list are set before the container renders, so widgets find their group
  public widgets$: Observable<BasicWidget[]> = this._context$.pipe(
    tap(([ikoViewKey, tabKey, entryId]) => this.setDataSource(ikoViewKey, tabKey, entryId)),
    switchMap(([ikoViewKey, tabKey]) => this.ikoApiService.getIkoWidget(ikoViewKey, tabKey)),
    tap((widgets: BasicWidget[]) => this.widgetDataGroupService.setWidgets(widgets))
  );

  public widgetLayout$: Observable<WidgetLayout | undefined> = combineLatest([
    this.ikoViewKey$,
    this.key$,
  ]).pipe(
    switchMap(([ikoViewKey, key]) =>
      this.ikoApiService
        .getIkoDetailTabs(ikoViewKey)
        .pipe(map(tabs => tabs.find(tab => tab.key === key)?.widgetLayout))
    )
  );
  public widgetParams$: Observable<IkoWidgetParams> = this._context$.pipe(
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
    [WidgetType.METROLINE]: IkoWidgetMetrolineComponent,
  };

  constructor(
    private readonly ikoTabService: IkoTabService,
    private readonly ikoApiService: IkoApiService,
    private readonly widgetDataGroupService: WidgetDataGroupService,
    private readonly logger: NGXLogger
  ) {}

  private setDataSource(ikoViewKey: string, tabKey: string, entryId: string): void {
    this.widgetDataGroupService.setSource({
      fetchGroup: (group: string) =>
        this.ikoApiService.getIkoWidgetDataGroup(ikoViewKey, tabKey, group, entryId),
      fetchWidget: (widgetKey: string) =>
        this.ikoApiService.getIkoWidgetData(ikoViewKey, tabKey, widgetKey, entryId),
    });
  }
}
