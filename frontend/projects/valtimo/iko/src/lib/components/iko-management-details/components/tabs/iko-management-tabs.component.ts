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
import {Component, computed, OnDestroy, OnInit, signal} from '@angular/core';
import {
  ActionItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
} from '@valtimo/components';
import {ButtonModule, IconModule, TabsModule} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, filter, Subscription, switchMap, tap} from 'rxjs';
import {map} from 'rxjs/operators';
import {ActivatedRoute, Router} from '@angular/router';
import {IkoManagementApiService} from '../../../../services';
import {TabDto} from '../../../../models';
import {toObservable} from '@angular/core/rxjs-interop';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {IkoManagementTabDetailsModalComponent} from '../tab-detail-modal/iko-management-tab-details-modal.component';
import {ModalCloseEvent, ModalMode} from '@valtimo/shared';
import {IKO_TABS_TEST_IDS} from '../../../../constants/iko.test-ids';

@Component({
  standalone: true,
  templateUrl: './iko-management-tabs.component.html',
  imports: [
    CommonModule,
    CarbonListModule,
    TabsModule,
    CarbonListModule,
    ButtonModule,
    IconModule,
    IkoManagementTabDetailsModalComponent,
    TranslatePipe,
    ConfirmationModalModule,
  ],
})
export class IkoManagementTabsComponent implements OnInit, OnDestroy {
  public readonly testIds = IKO_TABS_TEST_IDS;

  public readonly $disableInput = signal<boolean>(true);
  public readonly $ikoTabDtos = signal<TabDto[]>([]);
  public readonly $usedKeys = computed(() =>
    this.$ikoTabDtos()
      .filter(tab => tab.key !== this.$selectedTab()?.key)
      .map(tab => tab.key)
  );
  public readonly $loading = signal<boolean>(true);
  public readonly $selectedTab = signal<TabDto | null>(null);
  public readonly $openModal = signal<boolean>(false);
  public readonly $modalMode = signal<ModalMode>('add');
  public readonly openConfirmationModal$ = new BehaviorSubject<boolean>(false);

  private readonly _ikoViewKey$ = this.route.params.pipe(
    map(params => params?.key),
    filter(key => !!key)
  );

  private readonly _reloadTabs$ = new BehaviorSubject<null>(null);

  public readonly ikoTabs$ = combineLatest([
    toObservable(this.$ikoTabDtos),
    this.translateService.stream('key'),
  ]).pipe(
    map(([tabs]) =>
      tabs.map(tab => ({
        ...tab,
        type: this.translateService.instant(`ikoManagement.tabTypes.${tab.type}`),
        properties: this.getTabPropertiesView(tab),
      }))
    ),
    tap(() => this.$disableInput.set(false))
  );

  public readonly FIELDS: Array<ColumnConfig> = [
    {
      key: 'key',
      label: 'ikoManagement.tabKey',
      viewType: 'string',
      sortable: false,
    },
    {
      key: 'title',
      label: 'ikoManagement.tabTitle',
      viewType: 'string',
      sortable: false,
    },
    {
      key: 'type',
      label: 'ikoManagement.tabType',
      viewType: 'string',
      sortable: false,
    },
    {
      key: 'properties',
      label: 'ikoManagement.tabProperties',
      viewType: 'string',
      sortable: false,
    },
  ];

  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      label: 'interface.edit',
      callback: this.editTab.bind(this),
    },
    {
      label: 'interface.delete',
      callback: this.onDeleteClicked.bind(this),
      type: 'danger',
    },
  ];

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly ikoManagementApiService: IkoManagementApiService,
    private readonly translateService: TranslateService,
    private readonly router: Router
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      combineLatest([this._ikoViewKey$, this._reloadTabs$])
        .pipe(
          tap(() => this.$disableInput.set(true)),
          switchMap(([key]) => this.ikoManagementApiService.getIkoTabs(key)),
          tap(res => {
            this.$ikoTabDtos.set(res);
            this.$loading.set(false);
          })
        )
        .subscribe()
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onRowClicked(event: {key: string}): void {
    const tabDto = this.$ikoTabDtos().find(column => column.key === event.key);
    if (!tabDto) return;

    if (tabDto.type === 'widgets') {
      this.router.navigate(['widget-details', tabDto.key], {relativeTo: this.route});
      return;
    }

    this.editTab(event);
  }

  public editTab(event: {key: string}): void {
    const tabDto = this.$ikoTabDtos().find(column => column.key === event.key);
    if (!tabDto) return;
    this.$selectedTab.set({...tabDto});
    this.$openModal.set(true);
    this.$modalMode.set('edit');
  }

  public onDeleteClicked(event: {key: string}): void {
    const tabDto = this.$ikoTabDtos().find(tab => tab.key === event.key);
    if (!tabDto) return;
    this.$selectedTab.set({...tabDto});
    this.openConfirmationModal$.next(true);
  }

  public onItemsReordered(items: {key: string}[]): void {
    const tabs = this.$ikoTabDtos();
    const mappedItems = items
      .map(item => tabs.find(column => column.key === item.key))
      .map((item, index) => ({...item, order: index, title: item.title || null}));

    this.disableInput();

    this._ikoViewKey$
      .pipe(switchMap(key => this.ikoManagementApiService.updateIkoTabs(key, mappedItems)))
      .subscribe({
        next: () => {
          this.enableInput();
          this.reloadTabs();
        },
        error: () => {
          this.enableInput();
        },
      });
  }

  public onCreateButtonClicked(): void {
    this.$modalMode.set('add');
    this.$selectedTab.set({title: '', key: '', type: '', properties: {}});
    this.openModal();
  }

  private closeModal(): void {
    this.$openModal.set(false);
  }

  public onCloseModalEvent(event: ModalCloseEvent): void {
    this.closeModal();
    if (event === 'closeAndRefresh') this.reloadTabs();
  }

  public openModal(): void {
    this.$openModal.set(true);
  }

  public onDeleteTab(event: {key: string}): void {
    this.disableInput();

    this._ikoViewKey$
      .pipe(switchMap(key => this.ikoManagementApiService.deleteIkoTab(key, event.key)))
      .subscribe({
        next: () => {
          this.reloadTabs();
          this.enableInput();
        },
        error: () => {
          this.enableInput();
        },
      });
  }

  private getTabPropertiesView(tab: TabDto): string | null {
    if (!tab?.properties || Object.keys(tab.properties).length === 0) {
      return null;
    }

    return Object.entries(tab.properties)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  }

  private disableInput(): void {
    this.$disableInput.set(true);
  }

  private enableInput(): void {
    this.$disableInput.set(false);
  }

  private reloadTabs(): void {
    this._reloadTabs$.next(null);
  }
}
