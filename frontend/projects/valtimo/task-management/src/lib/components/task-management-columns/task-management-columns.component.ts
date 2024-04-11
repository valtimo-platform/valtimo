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

import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {
  ActionItem,
  CARBON_CONSTANTS,
  CARBON_THEME,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  MoveRowDirection,
  MoveRowEvent,
} from '@valtimo/components';
import {CommonModule} from '@angular/common';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {ButtonModule, IconModule, TabsModule} from 'carbon-components-angular';
import {TaskManagementApiService, TaskManagementService} from '../../services';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  Subject,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {ActivatedRoute} from '@angular/router';
import {
  TaskListColumn,
  TaskListColumnDisplayTypeParameters,
  TaskListColumnModalCloseEvent,
  TaskListColumnModalType,
} from '@valtimo/task';
import {TaskManagementColumnModalComponent} from '../task-management-column-modal/task-management-column-modal.component';

@Component({
  selector: 'valtimo-task-management-columns',
  templateUrl: './task-management-columns.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    CarbonListModule,
    TranslateModule,
    TabsModule,
    TaskManagementColumnModalComponent,
    ButtonModule,
    IconModule,
    ConfirmationModalModule,
  ],
  providers: [TaskManagementService],
})
export class TaskManagementColumnsComponent {
  @Input() public carbonTheme: CARBON_THEME = CARBON_THEME.G10;

  private readonly _refreshColumns$ = new BehaviorSubject<null | 'noAnimation'>(null);

  public readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params?.name),
    filter(name => !!name)
  );

  public readonly loadingColumns$ = new BehaviorSubject<boolean>(true);

  public readonly selectedTaskListColumn$ = new Subject<TaskListColumn>();

  public readonly cachedTaskListColumns$ = new BehaviorSubject<TaskListColumn[]>([]);

  public readonly taskListColumns$: Observable<TaskListColumn[]> = combineLatest([
    this.documentDefinitionName$,
    this._refreshColumns$,
    this.translateService.stream('key'),
  ]).pipe(
    tap(([_, refresh]) => {
      if (refresh !== 'noAnimation') this.loadingColumns$.next(true);
    }),
    switchMap(([documentDefinitionName]) =>
      this.taskManagementApiService.getTaskListColumns(documentDefinitionName)
    ),
    tap(columns => {
      this.cachedTaskListColumns$.next(columns);
    }),
    map(columns =>
      columns.map(column => ({
        ...column,
        title: column.title || '-',
        sortable: column.sortable
          ? this.translateService.instant('listColumn.sortableYes')
          : this.translateService.instant('listColumn.sortableNo'),
        defaultSort:
          (column.defaultSort === 'ASC' &&
            this.translateService.instant('listColumn.sortableAsc')) ||
          (column.defaultSort === 'DESC' &&
            this.translateService.instant('listColumn.sortableDesc')) ||
          '-',
        displayType: this.translateService.instant(
          `listColumnDisplayType.${column?.displayType?.type}`
        ),
        displayTypeParameters: this.getDisplayTypeParametersView(
          column.displayType.displayTypeParameters
        ),
      }))
    ),
    tap(() => {
      this.enable();
      this.loadingColumns$.next(false);
    })
  );

  public readonly showDeleteModal$ = new Subject<boolean>();
  public readonly deleteRowKey$ = new BehaviorSubject<string>('');

  public readonly disabled$ = new BehaviorSubject<boolean>(true);

  public readonly fields: Array<ColumnConfig> = [
    {
      viewType: 'string',
      sortable: false,
      key: 'title',
      label: 'listColumn.title',
    },
    {
      viewType: 'string',
      sortable: false,
      key: 'key',
      label: 'listColumn.key',
    },
    {
      viewType: 'string',
      sortable: false,
      key: 'path',
      label: 'listColumn.path',
    },
    {
      viewType: 'string',
      sortable: false,
      key: 'displayType',
      label: 'listColumn.displayType',
    },
    {
      viewType: 'string',
      sortable: false,
      key: 'displayTypeParameters',
      label: 'listColumn.displayTypeParameters',
    },
    {
      viewType: 'string',
      sortable: false,
      key: 'sortable',
      label: 'listColumn.sortable',
    },
    {
      viewType: 'string',
      sortable: false,
      key: 'defaultSort',
      label: 'listColumn.defaultSort',
    },
  ];

  public readonly actionItems: ActionItem[] = [
    {
      label: 'interface.delete',
      callback: this.deleteRow.bind(this),
      type: 'danger',
    },
  ];

  public readonly modalType$ = new Subject<TaskListColumnModalType>();
  public readonly showModal$ = new Subject<boolean>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly taskManagementApiService: TaskManagementApiService,
    private readonly translateService: TranslateService
  ) {}

  public refreshColumns(noAnimation = false): void {
    this._refreshColumns$.next(noAnimation ? 'noAnimation' : null);
  }

  public deleteRow(taskListColumn: TaskListColumn): void {
    this.showDeleteModal$.next(true);
    this.deleteRowKey$.next(taskListColumn.key);
  }

  public onMoveRowClick(event: MoveRowEvent, documentDefinitionName: string): void {
    const {direction, index} = event;

    this.disable();

    this.cachedTaskListColumns$
      .pipe(
        take(1),
        switchMap(taskListColumns =>
          this.taskManagementApiService.swapTaskListColumns(
            documentDefinitionName,
            taskListColumns[index],
            taskListColumns[direction === MoveRowDirection.UP ? index - 1 : index + 1]
          )
        )
      )
      .subscribe({
        next: () => {
          this.refreshColumns(true);
        },
        error: () => this.enable(),
      });
  }

  public columnRowClicked(row: {key: string}): void {
    this.cachedTaskListColumns$.pipe(take(1)).subscribe(cachedTaskListColumns => {
      const selectedTaskListColumn = cachedTaskListColumns.find(column => column.key === row.key);
      this.selectedTaskListColumn$.next(selectedTaskListColumn);
      this.showModal('edit');
    });
  }

  public showModal(type: TaskListColumnModalType): void {
    this.modalType$.next(type);
    this.showModal$.next(true);
  }

  public onModalCloseEvent(event: TaskListColumnModalCloseEvent): void {
    this.showModal$.next(false);

    if (event === 'refresh') {
      this.disable();
      this.refreshColumns();
    }

    setTimeout(() => {
      this.clearSelectedTaskListColumn();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  public deleteRowConfirmation(columnKey: string, documentDefinitionName: string): void {
    this.disable();

    this.taskManagementApiService
      .deleteTaskListColumn(documentDefinitionName, columnKey)
      .subscribe({
        next: () => {
          this.refreshColumns(true);
        },
        error: () => this.enable(),
      });
  }

  private getDisplayTypeParametersView(
    displayTypeParameters: TaskListColumnDisplayTypeParameters
  ): string {
    if (displayTypeParameters?.dateFormat) {
      return displayTypeParameters.dateFormat;
    } else if (displayTypeParameters?.enum) {
      return Object.keys(displayTypeParameters.enum).reduce((acc, curr) => {
        const keyValuePairString = `${curr}: ${displayTypeParameters.enum[curr]}`;
        if (!acc) {
          return `${keyValuePairString}`;
        }

        return `${acc}, ${keyValuePairString}`;
      }, '');
    }

    return '-';
  }

  private disable(): void {
    this.disabled$.next(true);
  }

  private enable(): void {
    this.disabled$.next(false);
  }

  private clearSelectedTaskListColumn(): void {
    this.selectedTaskListColumn$.next(null);
  }
}
