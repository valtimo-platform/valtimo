/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
  ChangeDetectorRef,
  Component,
  signal,
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
import {
  CaseManagementParams,
  EditPermissionsService,
  getCaseManagementRouteParams,
} from '@valtimo/shared';
import {ButtonModule, IconModule, NotificationModule, TagModule} from 'carbon-components-angular';
import {BehaviorSubject, Observable, of, switchMap, tap} from 'rxjs';
import {catchError, take} from 'rxjs/operators';
import {ManagementStartableItem, StartableItemType} from '../../../../models';
import {StartableItemManagementService} from '../../../../services';
import {CaseManagementActionsModalComponent} from './case-management-actions-modal/case-management-actions-modal.component';

@Component({
  standalone: true,
  selector: 'valtimo-case-management-actions',
  templateUrl: './case-management-actions.component.html',
  styleUrls: ['./case-management-actions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    CarbonListModule,
    ButtonModule,
    IconModule,
    NotificationModule,
    TagModule,
    CaseManagementActionsModalComponent,
    ConfirmationModalModule,
  ],
  providers: [StartableItemManagementService],
})
export class CaseManagementActionsComponent implements AfterViewInit {
  @ViewChild('typeColumn') typeColumnTemplate: TemplateRef<any>;

  public readonly StartableItemType = StartableItemType;

  public readonly caseManagementRouteParams$ = getCaseManagementRouteParams(this.route).pipe(
    tap(params => {
      this.startableItemManagementService.setParams(params);
      this.startableItemManagementService.loadItems();
    })
  );

  public readonly fields$ = new BehaviorSubject<ColumnConfig[]>([]);
  public readonly loading$: Observable<boolean> = this.startableItemManagementService.loading$;
  public readonly dragAndDropDisabled = signal(false);

  public readonly items$: Observable<ManagementStartableItem[]> =
    this.startableItemManagementService.items$.pipe(
      tap(() => {
        this.dragAndDropDisabled.set(false);
      })
    );

  private readonly params$: Observable<CaseManagementParams | undefined> =
    getCaseManagementRouteParams(this.route);

  public readonly hasEditPermissions$: Observable<boolean> = this.params$.pipe(
    switchMap(params =>
      this.editPermissionsService.hasEditPermissions(
        params?.caseDefinitionKey,
        params?.caseDefinitionVersionTag
      )
    )
  );

  public readonly showDeleteModal$ = this.startableItemManagementService.showDeleteModal$;
  public readonly itemToDelete$ = this.startableItemManagementService.itemToDelete$;

  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      label: 'interface.edit',
      callback: this.onEditItem.bind(this),
    },
    {
      label: 'interface.delete',
      callback: this.onDeleteItem.bind(this),
      type: 'danger',
    },
  ];

  constructor(
    private readonly cd: ChangeDetectorRef,
    private readonly route: ActivatedRoute,
    private readonly startableItemManagementService: StartableItemManagementService,
    private readonly editPermissionsService: EditPermissionsService
  ) {}

  public ngAfterViewInit(): void {
    this.cd.detectChanges();
    this.setFields();
  }

  public onAddItemClick(): void {
    this.startableItemManagementService.showCreateModal();
  }

  public onItemsReorderedEvent(reorderedItems: ManagementStartableItem[]): void {
    if (!reorderedItems) return;

    this.dragAndDropDisabled.set(true);
    this.startableItemManagementService.updateOrder(reorderedItems);
  }

  public onDeleteConfirm(item: ManagementStartableItem): void {
    this.startableItemManagementService
      .deleteItem(item)
      .pipe(
        take(1),
        catchError(() => of(null))
      )
      .subscribe(() => {
        this.startableItemManagementService.hideDeleteModal();
        this.startableItemManagementService.loadItems();
      });
  }

  private onEditItem(item: ManagementStartableItem): void {
    this.startableItemManagementService.showEditModal(item);
  }

  private onDeleteItem(item: ManagementStartableItem): void {
    this.startableItemManagementService.showDeleteConfirmation(item);
  }

  private setFields(): void {
    this.fields$.next([
      {
        key: 'name',
        label: 'caseManagement.actions.columns.name',
        viewType: ViewType.TEXT,
      },
      {
        viewType: ViewType.TEMPLATE,
        template: this.typeColumnTemplate,
        key: '',
        label: 'caseManagement.actions.columns.type',
      },
    ]);
  }
}
