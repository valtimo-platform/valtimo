/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
import {ChangeDetectionStrategy, Component, HostBinding, OnDestroy} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {BehaviorSubject, combineLatest, filter, map, Observable, switchMap, tap} from 'rxjs';
import {
  DossierTabService,
  DossierWidgetsApiService,
  DossierWidgetsLayoutService,
} from '../../../../services';
import {LoadingModule} from 'carbon-components-angular';
import {WidgetsContainerComponent} from './components/widgets-container/widgets-container.component';
import {CarbonListModule} from '@valtimo/components';
import {TranslateModule} from '@ngx-translate/core';

@Component({
  templateUrl: './widgets.component.html',
  styleUrls: ['./widgets.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    LoadingModule,
    WidgetsContainerComponent,
    CarbonListModule,
    TranslateModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DossierDetailWidgetsComponent implements OnDestroy {
  @HostBinding('class.tab--no-margin') private readonly _noMargin = true;
  @HostBinding('class.tab--no-background') private readonly _noBackground = true;
  @HostBinding('class.tab--no-min-height') private readonly _noMinHeight = true;

  private readonly _documentDefinitionName$ = this.route.params.pipe(
    map(params => params?.documentDefinitionName),
    filter(documentDefinitionName => !!documentDefinitionName)
  );

  private readonly _tabKey$: Observable<string> = this.dossierTabService.activeTabKey$;

  public readonly loadingWidgetConfiguration$ = new BehaviorSubject<boolean>(true);

  public readonly widgetConfiguration$ = combineLatest([
    this._documentDefinitionName$,
    this._tabKey$,
  ]).pipe(
    switchMap(([documentDefinitionName, tabKey]) =>
      this.widgetsApiService.getWidgetTabConfiguration(documentDefinitionName, tabKey)
    ),
    tap(() => this.loadingWidgetConfiguration$.next(false))
  );

  public readonly dataLoadedForAllWidgets$ =
    this.dossierWidgetsLayoutService.dataLoadedForAllWidgets$;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly dossierTabService: DossierTabService,
    private readonly widgetsApiService: DossierWidgetsApiService,
    private readonly dossierWidgetsLayoutService: DossierWidgetsLayoutService
  ) {}

  public ngOnDestroy(): void {
    this.dossierWidgetsLayoutService.reset();
  }
}
