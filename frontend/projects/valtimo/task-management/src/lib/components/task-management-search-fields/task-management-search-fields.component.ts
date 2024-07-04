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
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ActionItem,
  CarbonListItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  ViewType,
} from '@valtimo/components';
import {TaskListSearchField} from '@valtimo/task';
import {ButtonModule, IconModule} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, filter, map, Observable, switchMap, take, tap} from 'rxjs';
import {TaskManagementSearchFieldsService} from '../../services';
import {TaskManagementSearchFieldsModalComponent} from '../task-management-search-fields-modal/task-management-search-fields-modal.component';

@Component({
  selector: 'valtimo-task-management-search-fields',
  templateUrl: 'task-management-search-fields.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    CarbonListModule,
    ButtonModule,
    IconModule,
    TaskManagementSearchFieldsModalComponent,
    ConfirmationModalModule,
  ],
})
export class TaskManagementSearchFieldsComponent {
  private readonly _documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params.name || ''),
    filter(docDefName => !!docDefName),
    tap((docDefName: string) => this.searchFieldsService.setDocumentDefinitionName(docDefName))
  );

  private readonly _refresh$ = new BehaviorSubject<null>(null);

  public readonly searchFields$: Observable<TaskListSearchField[]> = combineLatest([
    this._documentDefinitionName$,
    this._refresh$,
  ]).pipe(switchMap(() => this.searchFieldsService.getTaskListSearchFields()));

  public readonly fields$: Observable<ColumnConfig[]> = this.trasnlateService.stream('key').pipe(
    map(() => [
      {
        key: 'title',
        label: 'searchFieldsOverview.title',
        viewType: ViewType.TEXT,
      },
      {
        key: 'key',
        label: 'searchFieldsOverview.key',
        viewType: ViewType.TEXT,
      },
      {
        key: 'path',
        label: 'searchFieldsOverview.path',
        viewType: ViewType.TEXT,
      },
      {
        key: 'dataType',
        label: 'searchFieldsOverview.dataType',
        viewType: ViewType.TEXT,
      },
      {
        key: 'fieldType',
        label: 'searchFieldsOverview.fieldType',
        viewType: ViewType.TEXT,
      },
    ])
  );

  public readonly deleteModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly fieldModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly keyToDelete$ = new BehaviorSubject<string | null>(null);
  public readonly prefillData$ = new BehaviorSubject<TaskListSearchField | null>(null);

  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      label: 'interface.edit',
      callback: this.editField.bind(this),
      type: 'normal',
    },
    {
      label: 'interface.delete',
      callback: this.deleteField.bind(this),
      type: 'danger',
    },
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly searchFieldsService: TaskManagementSearchFieldsService,
    private readonly trasnlateService: TranslateService
  ) {}

  public editField(item: TaskListSearchField): void {
    this.prefillData$.next(item);
    this.fieldModalOpen$.next(true);
  }

  public onItemsReordered(event): void {
    this.searchFieldsService
      .orderTaskListSearchFields(event)
      .pipe(take(1))
      .subscribe(() => this._refresh$.next(null));
  }

  public onAddButtonClick(): void {
    this.fieldModalOpen$.next(true);
  }

  public onCloseEvent(
    searchField: TaskListSearchField | null,
    prefillData: TaskListSearchField | null
  ): void {
    this.fieldModalOpen$.next(false);
    this.prefillData$.next(null);
    if (!searchField) return;

    (!prefillData
      ? this.searchFieldsService.createTaskListSearchField(searchField)
      : this.searchFieldsService.updateTaskListSearchField(searchField)
    )
      .pipe(take(1))
      .subscribe(() => this._refresh$.next(null));
  }

  public onDeleteFieldConfirm(key: string | null): void {
    if (!key) return;

    this.searchFieldsService
      .deleteTaskListSearchField(key)
      .pipe(take(1))
      .subscribe(() => this._refresh$.next(null));
  }

  private deleteField(item: TaskListSearchField): void {
    this.keyToDelete$.next(item.key);
    this.deleteModalOpen$.next(true);
  }
}
