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
  OnDestroy,
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
  EditPermissionsService,
  getCaseManagementRouteParams,
} from '@valtimo/shared';
import {
  BuildingBlockProcessLinkCreateDto,
  BuildingBlockProcessLinkUpdateDto,
  BuildingBlockStateService,
  ensureDocPrefix,
  ProcessLinkButtonService,
  ProcessLinkModule,
  ProcessLinkStateService,
  ProcessLinkStepService,
} from '@valtimo/process-link';
import {ButtonModule, IconModule, NotificationModule, TagModule} from 'carbon-components-angular';
import {BehaviorSubject, Observable, of, shareReplay, Subscription, switchMap, tap} from 'rxjs';
import {catchError, filter, take} from 'rxjs/operators';
import {BuildingBlockConfigRequest, ManagementStartableItem, StartableItemType} from '../../../../models';
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
    ProcessLinkModule,
  ],
  providers: [StartableItemManagementService, ProcessLinkStateService, ProcessLinkStepService, ProcessLinkButtonService],
})
export class CaseManagementActionsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('typeColumn') public typeColumnTemplate!: TemplateRef<any>;

  public readonly StartableItemType = StartableItemType;

  public readonly caseManagementRouteParams$ = getCaseManagementRouteParams(this.route).pipe(
    tap(params => {
      this.startableItemManagementService.setParams(params);
      this.startableItemManagementService.loadItems();
    }),
    shareReplay(1)
  );

  public readonly fields$ = new BehaviorSubject<ColumnConfig[]>([]);
  public readonly loading$: Observable<boolean> = this.startableItemManagementService.loading$;
  public readonly dragAndDropDisabled = signal(false);

  public readonly items$: Observable<ManagementStartableItem[]> =
    this.startableItemManagementService.items$;

  public readonly hasEditPermissions$: Observable<boolean> = this.caseManagementRouteParams$.pipe(
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

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly cd: ChangeDetectorRef,
    private readonly route: ActivatedRoute,
    private readonly startableItemManagementService: StartableItemManagementService,
    private readonly editPermissionsService: EditPermissionsService,
    private readonly processLinkStateService: ProcessLinkStateService,
    private readonly processLinkStepService: ProcessLinkStepService,
    private readonly buildingBlockStateService: BuildingBlockStateService
  ) {
    this.subscribeToProcessLinkEvents();
    this._subscriptions.add(
      this.startableItemManagementService.reorderComplete$.subscribe(() => {
        this.dragAndDropDisabled.set(false);
      })
    );
  }

  public ngAfterViewInit(): void {
    this.cd.detectChanges();
    this.setFields();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onRowClicked(item: ManagementStartableItem): void {
    this.hasEditPermissions$
      .pipe(
        filter(hasPermission => hasPermission),
        take(1)
      )
      .subscribe(() => {
        this.onEditItem(item);
      });
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

  public onConfigureBuildingBlock(request: BuildingBlockConfigRequest): void {
    this.openProcessLinkModalForBuildingBlock(
      request.buildingBlockDefinitionKey,
      request.buildingBlockDefinitionVersionTag
    );
  }

  private onEditItem(item: ManagementStartableItem): void {
    if (item.type === StartableItemType.BUILDING_BLOCK) {
      this.openProcessLinkModalForBuildingBlockEdit(item);
    } else {
      this.startableItemManagementService.showEditModal(item);
    }
  }

  private onDeleteItem(item: ManagementStartableItem): void {
    this.startableItemManagementService.showDeleteConfirmation(item);
  }

  private openProcessLinkModalForBuildingBlock(key: string, versionTag: string): void {
    this.processLinkStepService.setSkipBuildingBlockSelectionStep(true);

    this.processLinkStateService.setModalParams({
      element: {id: 'ad-hoc', type: 'bpmn:CallActivity', name: key, activityListenerType: 'callActivity'},
      processDefinitionKey: '',
      processDefinitionId: '',
    });
    this.processLinkStateService.setElementName(key);
    this.buildingBlockStateService.setDefinitionKey(key, versionTag);

    // Set the process link type without triggering default step navigation
    this.processLinkStepService.setHasOneProcessLinkType(true);
    this.processLinkStateService.selectProcessLinkType('building-block', true);

    // Override: skip directly to the configureBuildingBlockPlugins step
    // since the building block is already selected in the actions modal
    this.processLinkStepService.setConfigureBuildingBlockPluginsStep(key);

    this.processLinkStateService.showModal();
  }

  private openProcessLinkModalForBuildingBlockEdit(item: ManagementStartableItem): void {
    this.processLinkStepService.setSkipBuildingBlockSelectionStep(true);

    this.startableItemManagementService
      .getItemProperties(item.key, item.versionTag, StartableItemType.BUILDING_BLOCK)
      .pipe(take(1))
      .subscribe(properties => {
        this.processLinkStateService.setModalParams({
          element: {id: 'ad-hoc', type: 'bpmn:CallActivity', name: item.name || item.key, activityListenerType: 'callActivity'},
          processDefinitionKey: '',
          processDefinitionId: '',
        });
        this.processLinkStateService.setElementName(item.name || item.key);

        this.processLinkStateService.selectProcessLink({
          id: `${item.key}:${item.versionTag}`,
          processDefinitionId: '',
          activityId: 'ad-hoc',
          activityType: 'callActivity',
          processLinkType: 'building-block',
          buildingBlockDefinitionKey: item.key,
          buildingBlockDefinitionVersionTag: item.versionTag ?? '',
          inputMappings: properties?.inputMappings ?? [],
          outputMappings: properties?.outputMappings ?? [],
          pluginConfigurationMappings: properties?.pluginConfigurationMappings ?? {},
        });

        this.processLinkStateService.showModal();
      });
  }

  private subscribeToProcessLinkEvents(): void {
    this._subscriptions.add(
      this.processLinkStateService.processLinkCreateEvents$.subscribe(event => {
        this.processLinkStateService.stopSaving();
        this.processLinkStateService.closeModal();
        this.saveBuildingBlockStartableItem(event as BuildingBlockProcessLinkCreateDto);
      })
    );

    this._subscriptions.add(
      this.processLinkStateService.processLinkUpdateEvents$.subscribe(event => {
        this.processLinkStateService.stopSaving();
        this.processLinkStateService.closeModal();
        this.updateBuildingBlockStartableItem(event as BuildingBlockProcessLinkUpdateDto);
      })
    );
  }

  private saveBuildingBlockStartableItem(event: BuildingBlockProcessLinkCreateDto): void {
    const request = {
      type: StartableItemType.BUILDING_BLOCK,
      properties: {
        buildingBlockDefinitionKey: event.buildingBlockDefinitionKey,
        buildingBlockDefinitionVersionTag: event.buildingBlockDefinitionVersionTag,
        inputMappings: this.normalizeMappingsForSave(event.inputMappings || [], 'input'),
        outputMappings: this.normalizeMappingsForSave(event.outputMappings || [], 'output'),
        pluginConfigurationMappings: event.pluginConfigurationMappings || {},
      },
    };

    this.startableItemManagementService
      .createItem(request)
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.startableItemManagementService.loadItems();
      });
  }

  private updateBuildingBlockStartableItem(event: BuildingBlockProcessLinkUpdateDto): void {
    const key = event.buildingBlockDefinitionKey;
    const versionTag = event.buildingBlockDefinitionVersionTag;

    const request = {
      type: StartableItemType.BUILDING_BLOCK,
      properties: {
        buildingBlockDefinitionKey: key,
        buildingBlockDefinitionVersionTag: versionTag,
        inputMappings: this.normalizeMappingsForSave(event.inputMappings || [], 'input'),
        outputMappings: this.normalizeMappingsForSave(event.outputMappings || [], 'output'),
        pluginConfigurationMappings: event.pluginConfigurationMappings || {},
      },
    };

    this.startableItemManagementService
      .updateItem(key, versionTag, request)
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.startableItemManagementService.loadItems();
      });
  }

  /**
   * Ensures building block field references have the `doc:/` prefix for the backend value resolver.
   * For input mappings, the target is a building block field (needs prefix).
   * For output mappings, the source is a building block field (needs prefix).
   */
  private normalizeMappingsForSave(
    mappings: any[],
    direction: 'input' | 'output'
  ): any[] {
    return mappings.map(mapping => {
      if (direction === 'input') {
        return {...mapping, target: ensureDocPrefix(mapping.target)};
      }
      return {...mapping, source: ensureDocPrefix(mapping.source)};
    });
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
