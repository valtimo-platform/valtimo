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
import {ActivatedRoute, Router} from '@angular/router';
import {
  ActionItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  MenuService,
  PageTitleService,
} from '@valtimo/components';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, filter, switchMap, take, tap} from 'rxjs';
import {map} from 'rxjs/operators';
import {IKO_MANAGEMENT_TABS} from '../../constants';
import {IkoViewResponse} from '../../models';
import {IkoManagementApiService} from '../../services';
import {IkoManagementViewModalComponent} from './view-modal/iko-management-view-modal.component';
import {TranslateModule} from '@ngx-translate/core';
import {Upload16} from '@carbon/icons';
import {IkoManagementUploadModalComponent} from './upload-modal/iko-management-upload-modal.component';
import { ModalMode, IKO_TEST_IDS } from '@valtimo/shared';

@Component({
  selector: 'valtimo-iko-management',
  standalone: true,
  templateUrl: './iko-management.component.html',
  imports: [
    CommonModule,
    CarbonListModule,
    ButtonModule,
    IconModule,
    IkoManagementViewModalComponent,
    IkoManagementUploadModalComponent,
    TranslateModule,
    ConfirmationModalModule,
  ],
})
export class IkoManagementComponent implements OnInit, OnDestroy {
  readonly TEST_IDS = {
    IKO_TEST_IDS: IKO_TEST_IDS
  };

  public readonly $loading = signal<boolean>(true);
  public readonly usedKeys$ = new BehaviorSubject<string[]>([]);
  public readonly apiKey$ = this.route.params.pipe(
    map(params => params?.apiKey as string),
    filter(key => !!key)
  );
  private readonly _refresh$ = new BehaviorSubject<null>(null);
  public readonly ikoViews$ = combineLatest([this.apiKey$, this._refresh$]).pipe(
    tap(() => this.$loading.set(true)),
    switchMap(([apiKey]) =>
      this.ikoManagementApiService.getManagementIkoViews(undefined, undefined, apiKey).pipe(
        map(ikoViewPage => ikoViewPage.content),
        tap(content => {
          const keys = content?.map(item => item.key) ?? [];
          this.usedKeys$.next(keys);
          this.$loading.set(false);
        })
      )
    )
  );

  public readonly $modalMode = signal<ModalMode>('add');
  public readonly $viewModalOpen = signal<boolean>(false);
  public readonly $uploadModalOpen = signal<boolean>(false);
  public readonly $prefillData = signal<any | null>(null);
  public readonly $keyToDelete = signal<string | null>(null);
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);

  public readonly FIELDS: ColumnConfig[] = [
    {
      key: 'title',
      label: 'ikoManagement.views.title',
    },
  ];
  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      label: 'interface.edit',
      callback: this.onEditClick.bind(this),
    },
    {
      label: 'interface.delete',
      callback: this.onDeleteClick.bind(this),
      type: 'danger',
    },
  ];

  constructor(
    private readonly ikoManagementApiService: IkoManagementApiService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly pageTitleService: PageTitleService,
    private readonly menuService: MenuService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Upload16]);
  }

  public ngOnInit(): void {
    this.pageTitleService.disableReset();
    this.setPageTitle();
  }

  public ngOnDestroy(): void {
    this.pageTitleService.enableReset();
  }

  public onRowClicked(event: IkoViewResponse): void {
    this.apiKey$.pipe(take(1)).subscribe(apiKey => {
      this.router.navigate(['iko-management', apiKey, event.key, IKO_MANAGEMENT_TABS[0].key]);
    });
  }

  public openAddModal(): void {
    this.$modalMode.set('add');
    this.$prefillData.set(null);
    this.$viewModalOpen.set(true);
  }

  public openUploadModal(): void {
    this.$uploadModalOpen.set(true);
  }

  public onEditClick(item: IkoViewResponse): void {
    this.$modalMode.set('edit');
    this.$prefillData.set(item);
    this.$viewModalOpen.set(true);
  }

  public onDeleteClick(item: IkoViewResponse): void {
    this.$keyToDelete.set(item.key);
    this.showDeleteModal$.next(true);
  }

  public onDeleteConfirm(key: string): void {
    this.ikoManagementApiService.deleteIkoView(key).subscribe(() => {
      this.menuService.reload();
      this._refresh$.next(null);
    });
  }

  public onViewModalClose(item: IkoViewResponse | null, ikoRepositoryConfigKey: string) {
    this.$viewModalOpen.set(false);
    this.$prefillData.set(null);
    if (!item) return;

    if (this.$modalMode() === 'edit') {
      this.ikoManagementApiService
        .updateIkoView(item.key, {
          ...item,
          ikoRepositoryConfigKey,
        })
        .pipe(take(1))
        .subscribe(() => {
          this.menuService.reload();
          this._refresh$.next(null);
        });
      return;
    }

    this.ikoManagementApiService
      .createIkoView(item.key, {...item, ikoRepositoryConfigKey})
      .pipe(take(1))
      .subscribe(() => {
        this.menuService.reload();
        this._refresh$.next(null);
      });
  }

  public onUploadModalClose(item: boolean) {
    this.$uploadModalOpen.set(false);
    if (!item) return;

    this._refresh$.next(null);
    this.menuService.reload();
  }

  private setPageTitle(): void {
    this.apiKey$
      .pipe(
        take(1),
        switchMap(apiKey => this.ikoManagementApiService.getIkoRepositoryConfig(apiKey))
      )
      .subscribe(repositoryConfig => {
        this.pageTitleService.setCustomPageTitle(repositoryConfig.title);
      });
  }
}
