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
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  ViewType,
} from '@valtimo/components';
import {DocumentService} from '@valtimo/document';
import {
  TaskListSearchDropdownValue,
  TaskListSearchField,
  TaskListSearchFieldFieldType,
} from '@valtimo/task';
import {ButtonModule, IconModule} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  of,
  switchMap,
  take,
  tap,
} from 'rxjs';
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
  public readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params.name || ''),
    filter(docDefName => !!docDefName),
    tap((docDefName: string) => this.searchFieldsService.setDocumentDefinitionName(docDefName))
  );

  private readonly _refresh$ = new BehaviorSubject<null>(null);

  public readonly searchFields$: Observable<TaskListSearchField[]> = combineLatest([
    this.documentDefinitionName$,
    this._refresh$,
    this.trasnlateService.stream('key'),
  ]).pipe(
    switchMap(() => this.searchFieldsService.getTaskListSearchFields()),
    map((searchFields: TaskListSearchField[]) => this.mapTranslations(searchFields))
  );

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
        key: 'dataTypeTranslation',
        label: 'searchFieldsOverview.dataType',
        viewType: ViewType.TEXT,
      },
      {
        key: 'fieldTypeTranslation',
        label: 'searchFieldsOverview.fieldType',
        viewType: ViewType.TEXT,
      },
    ])
  );

  public readonly deleteModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly fieldModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly itemToDelete$ = new BehaviorSubject<TaskListSearchField | null>(null);
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
    private readonly documentService: DocumentService,
    private readonly route: ActivatedRoute,
    private readonly searchFieldsService: TaskManagementSearchFieldsService,
    private readonly trasnlateService: TranslateService
  ) {}

  public editField(item: TaskListSearchField): void {
    if (!!item.dropdownDataProvider) {
      this.documentService
        .getDropdownData(item.dropdownDataProvider, item.ownerId, item.key)
        .pipe(take(1))
        .subscribe(dropdownValues => {
          item.dropdownValues = dropdownValues as TaskListSearchDropdownValue;
          this.prefillData$.next(item);
          this.fieldModalOpen$.next(true);
        });

      return;
    }
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

    const hasDropdownValues: boolean =
      searchField.fieldType === TaskListSearchFieldFieldType.SINGLE_SELECT_DROPDOWN ||
      searchField.fieldType === TaskListSearchFieldFieldType.MULTI_SELECT_DROPDOWN;

    (!prefillData
      ? this.searchFieldsService.createTaskListSearchField(searchField)
      : this.searchFieldsService.updateTaskListSearchField(searchField)
    )
      .pipe(
        take(1),
        switchMap((field: TaskListSearchField) => {
          return hasDropdownValues
            ? this.documentService.postDropdownData(
                field.dropdownDataProvider ?? '',
                field.ownerId,
                field.key,
                searchField.dropdownValues ?? {}
              )
            : of(field);
        })
      )
      .subscribe(() => this._refresh$.next(null));
  }

  public onDeleteFieldConfirm(item: TaskListSearchField | null): void {
    if (!item) return;

    this.searchFieldsService
      .deleteTaskListSearchField(item.key)
      .pipe(
        take(1),
        switchMap(() =>
          item.dropdownDataProvider
            ? this.documentService.deleteDropdownData(
                item.dropdownDataProvider,
                item.ownerId,
                item.key
              )
            : of()
        )
      )
      .subscribe(() => this._refresh$.next(null));
  }

  private deleteField(item: TaskListSearchField): void {
    this.itemToDelete$.next(item);
    this.deleteModalOpen$.next(true);
  }

  private mapTranslations(
    searchFields: TaskListSearchField[]
  ): (TaskListSearchField & {dataTypeTranslation: string; fieldTypeTranslation: string})[] {
    return searchFields.map((searchField: TaskListSearchField) => ({
      ...searchField,
      dataTypeTranslation: this.trasnlateService.instant(
        `searchFields.${searchField.dataType.toLowerCase()}`
      ),
      fieldTypeTranslation: this.trasnlateService.instant(
        `searchFieldsOverview.${this.fieldTypeTranslation(searchField.fieldType)}`
      ),
    }));
  }

  private fieldTypeTranslation(fieldType: TaskListSearchFieldFieldType): string {
    switch (fieldType) {
      case TaskListSearchFieldFieldType.TEXT_CONTAINS:
        return 'textContains';
      case TaskListSearchFieldFieldType.SINGLE_SELECT_DROPDOWN:
        return 'single-select-dropdown';
      case TaskListSearchFieldFieldType.MULTI_SELECT_DROPDOWN:
        return 'multi-select-dropdown';
      default:
        return fieldType.toLowerCase();
    }
  }
}
