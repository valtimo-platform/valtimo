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
import {TranslateModule} from '@ngx-translate/core';
import {
  ActionItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  PendingChangesComponent,
  ViewType,
} from '@valtimo/components';
import {ButtonModule, IconModule, TagModule} from 'carbon-components-angular';
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
import {
  ConfiguredColumn,
  DocumentenApiColumnModalType,
  DocumentenApiColumnModalTypeCloseEvent,
} from '../../models';
import {DocumentenApiColumnService} from '../../services';
import {DocumentenApiColumnModalComponent} from '../documenten-api-column-modal/documenten-api-column-modal.component';

@Component({
  selector: 'valtimo-documenten-api-columns',
  templateUrl: './documenten-api-columns.component.html',
  styleUrls: ['./documenten-api-columns.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    DocumentenApiColumnModalComponent,
    CarbonListModule,
    TranslateModule,
    ConfirmationModalModule,
    TagModule,
    ButtonModule,
    IconModule,
  ],
})
export class DocumentenApiColumnsComponent extends PendingChangesComponent {
  private readonly _reload$ = new BehaviorSubject<null | 'noAnimation'>(null);

  private readonly _documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params?.name),
    filter(docDefName => !!docDefName)
  );

  public get documentDefinitionName$(): Observable<string> {
    return this._documentDefinitionName$;
  }

  public readonly loading$ = new BehaviorSubject<boolean>(true);

  private readonly _documentColumns$: Observable<ConfiguredColumn[]> = combineLatest([
    this._documentDefinitionName$,
    this._reload$,
  ]).pipe(
    tap(([_, reload]) => {
      if (reload === null) this.loading$.next(true);
    }),
    switchMap(([documentDefinitionName]) =>
      this.zgwDocumentColumnService.getConfiguredColumns(documentDefinitionName)
    ),
    tap(() => {
      this.loading$.next(false);
    })
  );

  public readonly enabledColumns$ = this._documentColumns$.pipe(
    map((columns: ConfiguredColumn[]) =>
      columns.filter((column: ConfiguredColumn) => column.enabled)
    )
  );

  public readonly disabledColumns$ = this._documentColumns$.pipe(
    map((columns: ConfiguredColumn[]) =>
      columns.filter((column: ConfiguredColumn) => !column.enabled)
    )
  );

  public readonly fields: ColumnConfig[] = [
    {
      key: 'key',
      label: 'zgw.columns.column',
      viewType: ViewType.TEXT,
    },
    //TODO: enable when sorting is BE supported
    // {
    //   key: 'sort',
    //   label: 'interface.defaultSort',
    //   viewType: ViewType.TEXT,
    // },
  ];

  public readonly ACTION_ITEMS: ActionItem[] = [
    // TODO: enable when sorting is BE supported
    // {
    //   label: 'interface.edit',
    //   callback: this.openEditModal.bind(this),
    //   type: 'normal',
    // },
    {
      label: 'interface.delete',
      callback: this.openDeleteModal.bind(this),
      type: 'danger',
    },
  ];

  public readonly CARBON_THEME = 'g10';

  public readonly columnModalType$ = new BehaviorSubject<DocumentenApiColumnModalType>('closed');
  public readonly prefillColumn$ = new BehaviorSubject<ConfiguredColumn | undefined>(undefined);

  public readonly columnToUpdate$ = new BehaviorSubject<ConfiguredColumn | undefined>(undefined);
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly zgwDocumentColumnService: DocumentenApiColumnService
  ) {
    super();
  }

  public openDeleteModal(column: ConfiguredColumn): void {
    this.columnToUpdate$.next(column);
    this.showDeleteModal$.next(true);
  }

  public openEditModal(status: ConfiguredColumn): void {
    this.prefillColumn$.next(status);
    this.columnModalType$.next('edit');
  }

  public openAddModal(): void {
    this.columnModalType$.next('add');
  }

  public onCloseModal(closeModalEvent: DocumentenApiColumnModalTypeCloseEvent): void {
    if (closeModalEvent === 'closeAndRefresh') this.reload();

    this.columnModalType$.next('closed');
  }

  public confirmDeleteStatus(column: ConfiguredColumn, definitionName: string): void {
    this.zgwDocumentColumnService
      .updateColumn(definitionName, {...column, enabled: false})
      .subscribe(() => {
        this.reload();
      });
  }

  public onItemsReordered(
    definitionName: string,
    enabledColumns: ConfiguredColumn[],
    disabledColumns: ConfiguredColumn[]
  ): void {
    this.zgwDocumentColumnService
      .updateConfiguredColumns(definitionName, [...enabledColumns, ...disabledColumns])
      .subscribe(() => {
        this.reload(true);
      });
  }

  private reload(noAnimation = false): void {
    this._reload$.next(noAnimation ? 'noAnimation' : null);
  }
}
