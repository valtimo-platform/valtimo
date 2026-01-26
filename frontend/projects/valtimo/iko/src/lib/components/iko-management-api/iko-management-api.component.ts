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
import {
  ActionItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  PageTitleService,
  SelectItem,
  SelectModule,
  ValtimoCdsModalDirective,
} from '@valtimo/components';
import {IkoManagementApiService} from '../../services';
import {BehaviorSubject, Observable, switchMap, take, tap} from 'rxjs';
import {Router} from '@angular/router';
import {map} from 'rxjs/operators';
import {
  ButtonModule,
  IconModule,
  InputModule,
  LayerModule,
  ModalModule,
  TabsModule,
} from 'carbon-components-angular';
import {TranslateModule} from '@ngx-translate/core';
import {
  IkoViewResponse,
  IkoRepositoryConfigListResponse,
  IkoRepositoryConfigResponse,
} from '../../models';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {IkoManagementRepositoryModalComponent} from './repository-modal/iko-management-repository-modal.component';
import {ModalMode} from '@valtimo/shared';

@Component({
  selector: 'valtimo-iko-management-api',
  standalone: true,
  templateUrl: './iko-management-api.component.html',
  imports: [
    CommonModule,
    CarbonListModule,
    TabsModule,
    TranslateModule,
    ModalModule,
    ButtonModule,
    IconModule,
    FormsModule,
    InputModule,
    ReactiveFormsModule,
    ValtimoCdsModalDirective,
    LayerModule,
    SelectModule,
    ConfirmationModalModule,
    IkoManagementRepositoryModalComponent,
  ],
  styleUrl: './iko-management-api.component.scss',
})
export class IkoManagementApiComponent implements OnInit, OnDestroy {
  public readonly $modalOpen = signal<boolean>(false);
  public readonly $prefillData = signal<any | null>(null);
  public readonly $keyToDelete = signal<string | null>(null);
  public readonly $modalMode = signal<ModalMode>('add');
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);

  public readonly disabled$ = new BehaviorSubject(true);
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  private readonly _reload$ = new BehaviorSubject<null>(null);

  public readonly apiConfigs$ = this._reload$.pipe(
    switchMap(() => this.ikoManagementApiService.getIkoRepositoryConfigs()),
    map(res => res.content),
    tap(() => this.loading$.next(false))
  );

  public readonly FIELDS: ColumnConfig[] = [
    {
      key: 'title',
      label: 'ikoManagement.ikoServer',
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

  private readonly _ikoRepositoryTypes$ = this.ikoManagementApiService.getIkoRepositoryTypes();
  public readonly ikoRepositoryTypeSelectItems$: Observable<SelectItem[]> =
    this._ikoRepositoryTypes$.pipe(
      map(types => Object.keys(types).map(typeKey => ({id: typeKey, text: types[typeKey]}))),
      tap(() => {
        this.disabled$.next(false);
      })
    );

  constructor(
    private readonly ikoManagementApiService: IkoManagementApiService,
    private readonly pageTitleService: PageTitleService,
    private readonly router: Router
  ) {}

  public ngOnInit(): void {
    this.pageTitleService.disableReset();
  }

  public ngOnDestroy(): void {
    this.pageTitleService.enableReset();
  }

  public onRowClicked(event: IkoRepositoryConfigListResponse): void {
    this.router.navigate(['iko-management', event.key]);
  }

  public openModal(): void {
    this.$modalMode.set('add');
    this.$modalOpen.set(true);
  }

  public closeModal(item: IkoRepositoryConfigResponse | null): void {
    this.$modalOpen.set(false);
    this.disable();
    this.$prefillData.set(null);
    if (!item) return;

    let saveObservable;
    if (this.$modalMode() === 'edit') {
      saveObservable = this.ikoManagementApiService.updateIkoRepositoryConfig(item.key, item);
    } else {
      saveObservable = this.ikoManagementApiService.createIkoRepositoryConfig(item.key, item);
    }

    saveObservable.pipe(take(1)).subscribe({
      next: () => {
        this.enable();
        this.reload();
      },
      error: () => this.enable(),
    });
  }

  public onEditClick(item: IkoViewResponse): void {
    this.$modalMode.set('edit');
    this.$prefillData.set(item);
    this.$modalOpen.set(true);
  }

  public onDeleteClick(item: IkoViewResponse): void {
    this.$keyToDelete.set(item.key);
    this.showDeleteModal$.next(true);
  }

  public onDeleteConfirm(key: string): void {
    this.ikoManagementApiService
      .deleteIkoRepositoryConfig(key)
      .subscribe(() => this._reload$.next(null));
  }

  private disable(): void {
    this.disabled$.next(true);
  }

  private enable(): void {
    this.disabled$.next(false);
  }

  private reload(): void {
    this.loading$.next(true);
    this._reload$.next(null);
  }
}
