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

import {Injectable, Injector, OnDestroy} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {SidePanelHandle, SidePanelService} from '@valtimo/components';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  merge,
  Observable,
  shareReplay,
  startWith,
  Subscription,
} from 'rxjs';
import {CaseDetailTaskPanelComponent} from '../components/case-detail-task-panel/case-detail-task-panel.component';
import {
  CASE_DETAIL_RIGHT_PANEL_MIN_WIDTHS,
  CASE_DETAIL_TASK_LIST_WIDTH,
} from '../constants/case-detail-layout.constants';
import {TaskPanelSize} from '../models';
import {CaseDetailLayoutService} from './case-detail-layout.service';
import {CaseTabService} from './case-tab.service';

let taskPanelCount = 0;

/**
 * Shows the case detail task panel in the app-wide side panel. Available on tabs that show tasks
 * and while a form is open in it; hidden but kept alive elsewhere, so an open form survives tab
 * switches; withdrawn when the case detail is left. Provide it in the case detail component: the
 * panel content is rendered with that component's injector.
 */
@Injectable()
export class CaseDetailTaskPanelService implements OnDestroy {
  /** Closed by the user, or taken over by other content. Explicitly opening a form resets it. */
  private readonly _closed$ = new BehaviorSubject<boolean>(false);
  // Per case detail instance, so an outgoing case detail never shares content with the next one.
  private readonly _key = `case-detail-tasks-${++taskPanelCount}`;
  private readonly _subscriptions = new Subscription();
  private _handle: SidePanelHandle | null = null;

  public readonly available$: Observable<boolean> = combineLatest([
    this.caseTabService.showTaskList$.pipe(startWith(false)),
    this.caseDetailLayoutService.startFormPanel$,
    this.caseDetailLayoutService.taskAndProcessLinkOpenedInPanel$,
  ]).pipe(
    map(
      ([showTaskList, startFormPanel, taskAndProcessLink]) =>
        showTaskList || !!startFormPanel || !!taskAndProcessLink
    ),
    distinctUntilChanged(),
    shareReplay({bufferSize: 1, refCount: true})
  );

  public readonly visible$: Observable<boolean> = combineLatest([
    this.available$,
    this._closed$,
  ]).pipe(
    map(([available, closed]) => available && !closed),
    distinctUntilChanged(),
    shareReplay({bufferSize: 1, refCount: true})
  );

  /** The width saved in the user settings; a form open in the panel needs at least its size. */
  private readonly _size$: Observable<TaskPanelSize> = combineLatest([
    this.caseDetailLayoutService.startFormPanel$,
    this.caseDetailLayoutService.taskAndProcessLinkOpenedInPanel$,
    this.caseDetailLayoutService.formDisplaySize$,
    this.caseDetailLayoutService.taskPanelWidth$,
  ]).pipe(
    map(([startFormPanel, taskAndProcessLink, formSize, savedWidth]) => {
      const minWidth =
        startFormPanel || taskAndProcessLink
          ? CASE_DETAIL_RIGHT_PANEL_MIN_WIDTHS[formSize]
          : undefined;
      return {minWidth, width: savedWidth ?? minWidth ?? CASE_DETAIL_TASK_LIST_WIDTH};
    }),
    distinctUntilChanged((a, b) => a.minWidth === b.minWidth && a.width === b.width)
  );

  constructor(
    private readonly caseDetailLayoutService: CaseDetailLayoutService,
    private readonly caseTabService: CaseTabService,
    private readonly injector: Injector,
    private readonly sidePanelService: SidePanelService,
    private readonly translateService: TranslateService
  ) {}

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this._handle?.withdraw();
    this._handle = null;
  }

  public open(): void {
    this._subscriptions.add(
      merge(
        this.caseDetailLayoutService.startFormPanel$,
        this.caseDetailLayoutService.taskAndProcessLinkOpenedInPanel$
      )
        .pipe(filter(opened => !!opened))
        .subscribe(() => this._closed$.next(false))
    );

    this._subscriptions.add(
      combineLatest([
        this.visible$,
        this._size$,
        this.translateService.stream('case.taskPanel.title'),
      ]).subscribe(([visible, size, title]) =>
        visible ? this.offer(title, size) : this._handle?.hide()
      )
    );
  }

  public toggle(): void {
    this._closed$.next(!this._closed$.getValue());
  }

  private offer(title: string, size: TaskPanelSize): void {
    const handle = this.sidePanelService.offer({
      key: this._key,
      title,
      component: CaseDetailTaskPanelComponent,
      injector: this.injector,
      ...size,
    });

    if (handle === this._handle) return;

    this._handle = handle;
    handle.dismissed$.subscribe(() => this._closed$.next(true));
    handle.resized$.subscribe(width => this.caseDetailLayoutService.saveTaskPanelWidth(width));
    handle.replaced$.subscribe(() => {
      this._handle = null;
      this._closed$.next(true);
    });
  }
}
