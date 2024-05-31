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
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {
  ActionItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  ViewType,
} from '@valtimo/components';
import {ButtonModule, IconModule, TagModule} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, filter, map, Observable, switchMap, tap} from 'rxjs';
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
export class DocumentenApiColumnsComponent implements AfterViewInit {
  @ViewChild('columnKeyTemplate') public readonly columnKeyTemplate: TemplateRef<any>;
  @ViewChild('defaultSortTemplate') public readonly defaultSortTemplate: TemplateRef<any>;

  private readonly _reload$ = new BehaviorSubject<null | 'noAnimation'>(null);

  private readonly _documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params?.name),
    filter(docDefName => !!docDefName)
  );

  public get documentDefinitionName$(): Observable<string> {
    return this._documentDefinitionName$;
  }

  public readonly loading$ = new BehaviorSubject<boolean>(true);

  public readonly configuredColumns$: Observable<ConfiguredColumn[]> = combineLatest([
    this._documentDefinitionName$,
    this._reload$,
  ]).pipe(
    tap(([_, reload]) => {
      if (reload === null) this.loading$.next(true);
    }),
    switchMap(([documentDefinitionName]) =>
      this.zgwDocumentColumnService.getAdminConfiguredColumns(documentDefinitionName)
    ),
    tap(() => {
      this.loading$.next(false);
    })
  );

  public readonly configurableColumns$: Observable<ConfiguredColumn[]> =
    this.documentDefinitionName$.pipe(
      switchMap((documentDefinitionName: string) =>
        combineLatest([
          this.zgwDocumentColumnService.getAdminConfigurableColumns(documentDefinitionName),
          this.configuredColumns$,
        ])
      ),
      map(([configurableColumns, configuredColumns]) => {
        const configuredKeys: string[] = configuredColumns.map(
          (column: ConfiguredColumn) => column.key
        );

        return configurableColumns.filter(
          (column: ConfiguredColumn) => !configuredKeys.includes(column.key)
        );
      })
    );

  public fields: ColumnConfig[];

  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      label: 'interface.edit',
      callback: this.openEditModal.bind(this),
      type: 'normal',
    },
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
  ) {}

  public ngAfterViewInit(): void {
    this.fields = [
      {
        key: 'key',
        label: 'zgw.columns.column',
        viewType: ViewType.TEMPLATE,
        template: this.columnKeyTemplate,
      },
      {
        key: 'defaultSort',
        label: 'listColumn.defaultSort',
        viewType: ViewType.TEMPLATE,
        template: this.defaultSortTemplate,
      },
    ];
  }

  public openDeleteModal(column: ConfiguredColumn): void {
    this.columnToUpdate$.next(column);
    this.showDeleteModal$.next(true);
  }

  public openEditModal(column: ConfiguredColumn): void {
    this.prefillColumn$.next(column);
    this.columnModalType$.next('edit');
  }

  public openAddModal(): void {
    this.columnModalType$.next('add');
    this.prefillColumn$.next(undefined);
  }

  public onCloseModal(closeModalEvent: DocumentenApiColumnModalTypeCloseEvent): void {
    if (closeModalEvent === 'closeAndRefresh') this.reload();

    this.columnModalType$.next('closed');
  }

  public confirmDeleteStatus(column: ConfiguredColumn, definitionName: string): void {
    this.zgwDocumentColumnService.deleteColumn(definitionName, column.key).subscribe(() => {
      this.reload();
    });
  }

  public onItemsReordered(definitionName: string, columns: ConfiguredColumn[]): void {
    this.zgwDocumentColumnService.updateConfiguredColumns(definitionName, columns).subscribe(() => {
      this.reload(true);
    });
  }

  private reload(noAnimation = false): void {
    this._reload$.next(noAnimation ? 'noAnimation' : null);
  }
}
