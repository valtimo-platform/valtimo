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
import {Component, OnDestroy, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ActivatedRoute} from '@angular/router';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  startWith,
  Subject,
  Subscription,
  switchMap,
  tap,
} from 'rxjs';
import {CaseHeaderWidgetApiService} from '../../services';
import {PermissionService} from '@valtimo/access-control';
import {CAN_VIEW_CASE_PERMISSION, CASE_DETAIL_PERMISSION_RESOURCE} from '../../permissions';
import {WidgetFieldComponent} from '@valtimo/layout';
import {InputModule, LayerModule, LoadingModule} from 'carbon-components-angular';
import {CARBON_THEME, CdsThemeService, CurrentCarbonTheme} from '@valtimo/components';
import {DocumentUpdatedSseEvent} from '../../models';
import {SseService} from '@valtimo/sse';

@Component({
  standalone: true,
  selector: 'valtimo-case-detail-header-widget',
  templateUrl: './case-detail-header-widget.component.html',
  styleUrls: ['./case-detail-header-widget.component.scss'],
  imports: [CommonModule, WidgetFieldComponent, LoadingModule, LayerModule, InputModule],
})
export class CaseDetailHeaderWidgetComponent implements OnInit, OnDestroy {
  private readonly _documentId$ = this.route.params.pipe(
    map(params => params?.documentId),
    filter(documentId => !!documentId),
    distinctUntilChanged()
  );

  public readonly canViewCaseHeaderWidget$ = this._documentId$.pipe(
    switchMap(documentId =>
      this.permissionService.requestPermission(CAN_VIEW_CASE_PERMISSION, {
        resource: CASE_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
        identifier: documentId,
      })
    )
  );

  private readonly _fetchData$ = new Subject<null>();

  private readonly _highContrast$ = new BehaviorSubject<boolean>(false);

  public readonly headerWidget$ = this._documentId$.pipe(
    switchMap(documentId => this.caseHeaderWidgetApiService.getHeaderWidget(documentId)),
    tap(widget => {
      if (!!widget) {
        this._fetchData$.next(null);
        this._highContrast$.next(widget.highContrast);
      }
    })
  );

  public readonly theme$ = combineLatest([
    this.cdsThemeService.currentTheme$,
    this._highContrast$,
  ]).pipe(
    map(([theme, highContrast]) => {
      const isLight = theme === CurrentCarbonTheme.WHITE || theme === CurrentCarbonTheme.G10;
      const normalTheme = isLight ? CARBON_THEME.G10 : CARBON_THEME.G90;
      const invertedTheme = normalTheme === CARBON_THEME.G10 ? CARBON_THEME.G90 : CARBON_THEME.G10;
      return highContrast ? invertedTheme : normalTheme;
    })
  );

  public readonly headerWidgetData$ = this._fetchData$.pipe(
    switchMap(() => this._documentId$),
    switchMap(documentId => this.caseHeaderWidgetApiService.getHeaderWidgetData(documentId))
  );

  private readonly _documentUpdates$ = combineLatest([
    this.sseService.getSseEventObservable<DocumentUpdatedSseEvent>('DOCUMENT_UPDATED'),
    this._documentId$,
  ]).pipe(
    filter(([event, documentId]) => event.documentId === documentId),
    map(([event]) => event),
    startWith<DocumentUpdatedSseEvent | null>(null)
  );

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly caseHeaderWidgetApiService: CaseHeaderWidgetApiService,
    private readonly route: ActivatedRoute,
    private readonly permissionService: PermissionService,
    private readonly cdsThemeService: CdsThemeService,
    private readonly sseService: SseService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(this._documentUpdates$.subscribe(() => this._fetchData$.next(null)));
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }
}
