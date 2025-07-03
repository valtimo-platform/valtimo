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

import {Injectable} from '@angular/core';
import {FormDisplayType, FormSize, TaskWithProcessLink} from '@valtimo/process-link';
import {BehaviorSubject, combineLatest, filter, map, Observable, startWith} from 'rxjs';
import {
  CASE_DETAIL_DEFAULT_DISPLAY_SIZE,
  CASE_DETAIL_DEFAULT_DISPLAY_TYPE,
  CASE_DETAIL_GUTTER_SIZE,
  CASE_DETAIL_LEFT_PANEL_MIN_WIDTH,
  CASE_DETAIL_RIGHT_PANEL_MIN_WIDTHS,
  CASE_DETAIL_TASK_LIST_WIDTH,
} from '../constants';
import {CaseDetailLayout} from '../models';
import {CaseTabService} from './case-tab.service';

@Injectable()
export class CaseDetailLayoutService {
  private readonly _tabContentContainerWidth$ = new BehaviorSubject<number | null>(null);
  private readonly _showTaskList$ = this.caseTabService.showTaskList$;
  private readonly _taskAndProcessLinkOpenedInPanel$ =
    new BehaviorSubject<TaskWithProcessLink | null>(null);
  private readonly _formDisplayType$ = new BehaviorSubject<FormDisplayType>(
    CASE_DETAIL_DEFAULT_DISPLAY_TYPE
  );
  private readonly _formDisplaySize$ = new BehaviorSubject<FormSize>(
    CASE_DETAIL_DEFAULT_DISPLAY_SIZE
  );
  private readonly _refreshTasks$ = new BehaviorSubject<null>(null);

  public get refreshTasks$(): Observable<null> {
    return this._refreshTasks$.asObservable();
  }

  public get tabContentContainerWidth$(): Observable<number | null> {
    return this._tabContentContainerWidth$.pipe(filter(width => typeof width === 'number'));
  }

  public get taskAndProcessLinkOpenedInPanel$(): Observable<TaskWithProcessLink | null> {
    return this._taskAndProcessLinkOpenedInPanel$.asObservable();
  }

  public get formDisplaySize$(): Observable<FormSize> {
    return this._formDisplaySize$.asObservable();
  }

  constructor(private readonly caseTabService: CaseTabService) {}

  public readonly caseDetailLayout$: Observable<CaseDetailLayout | any> = combineLatest([
    this.tabContentContainerWidth$,
    this._showTaskList$,
    this._taskAndProcessLinkOpenedInPanel$,
    this._formDisplayType$,
    this._formDisplaySize$,
  ]).pipe(
    map(
      ([
        tabContentContainerWidth,
        showTaskList,
        taskAndProcessLinkOpenedInPanel,
        formDisplayType,
        formDisplaySize,
      ]) => {
        if (!showTaskList) {
          return this.getInitialLayout();
        }

        if (!taskAndProcessLinkOpenedInPanel) {
          return this.getTaskListLayout();
        }

        if (taskAndProcessLinkOpenedInPanel && formDisplayType === 'panel') {
          return this.getPanelLayout(tabContentContainerWidth ?? 0, formDisplaySize);
        }

        return {} as CaseDetailLayout;
      }
    ),
    startWith({})
  );

  public setTabContentContainerWidth(width: number): void {
    this._tabContentContainerWidth$.next(width);
  }

  public setTaskAndProcessLinkOpenedInPanel(value: TaskWithProcessLink | null): void {
    this._taskAndProcessLinkOpenedInPanel$.next(value);
  }

  public setFormDisplayType(type: FormDisplayType): void {
    this._formDisplayType$.next(type);
  }

  public setFormDisplaySize(size: FormSize): void {
    this._formDisplaySize$.next(size);
  }

  public refreshTasks(): void {
    this._refreshTasks$.next(null);
  }

  private getInitialLayout(): CaseDetailLayout {
    return {
      showRightPanel: false,
      widthAdjustable: false,
      unit: 'percent',
      leftPanelWidth: '*',
    };
  }

  private getTaskListLayout(): CaseDetailLayout {
    return {
      unit: 'pixel',
      showRightPanel: true,
      widthAdjustable: false,
      rightPanelMaxWidth: CASE_DETAIL_TASK_LIST_WIDTH,
      rightPanelMinWidth: CASE_DETAIL_TASK_LIST_WIDTH,
      rightPanelWidth: CASE_DETAIL_TASK_LIST_WIDTH,
      leftPanelWidth: '*',
    };
  }

  private getPanelLayout(
    tabContentContainerWidth: number,
    formDisplaySize: FormSize
  ): CaseDetailLayout {
    const rightPanelMaxWidth =
      tabContentContainerWidth - CASE_DETAIL_GUTTER_SIZE - CASE_DETAIL_LEFT_PANEL_MIN_WIDTH;
    const rightPanelMinWidth = CASE_DETAIL_RIGHT_PANEL_MIN_WIDTHS[formDisplaySize];
    const rightPanelMinWidthToUse =
      rightPanelMinWidth < rightPanelMaxWidth ? rightPanelMinWidth : rightPanelMaxWidth;

    return {
      unit: 'pixel',
      showRightPanel: true,
      widthAdjustable: true,
      rightPanelMinWidth: rightPanelMinWidthToUse,
      rightPanelWidth: rightPanelMinWidthToUse,
      rightPanelMaxWidth,
      leftPanelWidth: '*',
    };
  }
}
