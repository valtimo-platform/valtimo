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
import {CommonModule} from '@angular/common';
import {Component, OnDestroy, OnInit, signal} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  Observable,
  Subscription,
  switchMap,
  tap,
} from 'rxjs';
import {map} from 'rxjs/operators';
import {CarbonListModule, ColumnConfig} from '@valtimo/components';
import {IkoManagementApiService} from '../../../../services';
import {ButtonModule, IconModule, TabsModule} from 'carbon-components-angular';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {getDisplayTypeParametersView} from '@valtimo/shared';
import {CloseListColumnModalEvent, IkoListColumnModalMode, ListColumnDto} from '../../../../models';
import {IkoManagementListModalComponent} from '../list-modal/list-modal.component';
import {toObservable} from '@angular/core/rxjs-interop';

@Component({
  standalone: true,
  selector: 'valtimo-iko-management-list-columns',
  templateUrl: './iko-management-list.component.html',
  styleUrls: ['./iko-management-list.component.scss'],
  imports: [
    CommonModule,
    CarbonListModule,
    TabsModule,
    TranslateModule,
    IkoManagementListModalComponent,
    ButtonModule,
    IconModule,
  ],
})
export class IkoManagementListComponent implements OnInit, OnDestroy {
  public readonly $openModal = signal<boolean>(false);
  public readonly $loading = signal<boolean>(true);
  public readonly $disableInput = signal<boolean>(true);
  public readonly $modalMode = signal<IkoListColumnModalMode>(IkoListColumnModalMode.ADD);

  private readonly _dataAggregateKey$: Observable<string> = this.route.params.pipe(
    map(params => params?.key),
    filter(key => !!key)
  );

  public readonly $ikoListColumnDtos = signal<ListColumnDto[]>([]);

  public readonly $selectedListColumn = signal<ListColumnDto | null>(null);

  private readonly _reloadColumns$ = new BehaviorSubject<null>(null);

  public readonly ikoListColumns$ = combineLatest([
    toObservable(this.$ikoListColumnDtos),
    this.translateService.stream('key'),
  ]).pipe(
    map(([columns]) =>
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
        displayTypeParameters: getDisplayTypeParametersView(
          column.displayType.displayTypeParameters
        ),
      }))
    ),
    tap(() => this.$disableInput.set(false))
  );

  public readonly FIELDS: Array<ColumnConfig> = [
    {
      key: 'title',
      label: 'listColumn.title',
      viewType: 'string',
      sortable: false,
    },
    {
      key: 'key',
      label: 'listColumn.key',
      viewType: 'string',
      sortable: false,
    },
    {
      key: 'path',
      label: 'listColumn.path',
      viewType: 'string',
      sortable: false,
    },
    {
      key: 'displayType',
      label: 'listColumn.displayType',
      viewType: 'string',
      sortable: false,
    },
    {
      key: 'displayTypeParameters',
      label: 'listColumn.displayTypeParameters',
      viewType: 'string',
      sortable: false,
    },
    {
      key: 'sortable',
      label: 'listColumn.sortable',
      viewType: 'string',
      sortable: false,
    },
    {
      key: 'defaultSort',
      label: 'listColumn.defaultSort',
      viewType: 'string',
      sortable: false,
    },
  ];

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly ikoManagementApiService: IkoManagementApiService,
    private readonly translateService: TranslateService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      combineLatest([this._dataAggregateKey$, this._reloadColumns$])
        .pipe(
          tap(() => this.$disableInput.set(true)),
          switchMap(([key]) => this.ikoManagementApiService.getIkoListColumns(key)),
          tap(res => {
            this.$ikoListColumnDtos.set(res);
            this.$loading.set(false);
          })
        )
        .subscribe()
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onItemsReordered(items: {id: string}[]): void {
    const listColumns = this.$ikoListColumnDtos();
    const mappedItems = items
      .map(item => listColumns.find(column => column.id === item.id))
      .map((item, index) => ({...item, order: index}));

    this.disableInput();

    this._dataAggregateKey$
      .pipe(
        switchMap(key => this.ikoManagementApiService.updateIkoListColumnOrder(key, mappedItems))
      )
      .subscribe({
        next: () => {
          this.enableInput();
          this.reloadColumns();
        },
        error: () => {
          this.enableInput();
        },
      });
  }

  public onRowClicked(event: {key: string}): void {
    const listColumnDto = this.$ikoListColumnDtos().find(column => column.key === event.key);
    if (!listColumnDto) return;
    this.$selectedListColumn.set({...listColumnDto});
    this.$openModal.set(true);
    this.$modalMode.set(IkoListColumnModalMode.EDIT);
  }

  public openModal(): void {
    this.$openModal.set(true);
  }

  public onCreateButtonClicked(): void {
    this.$modalMode.set(IkoListColumnModalMode.ADD);
    this.openModal();
  }

  private closeModal(): void {
    this.$openModal.set(false);
  }

  public onCloseModalEvent(event: CloseListColumnModalEvent): void {
    this.closeModal();
    if (event === 'closeAndRefresh') this.reloadColumns();
  }

  private disableInput(): void {
    this.$disableInput.set(true);
  }

  private enableInput(): void {
    this.$disableInput.set(false);
  }

  private reloadColumns(): void {
    this._reloadColumns$.next(null);
  }
}
