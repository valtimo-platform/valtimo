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
import {ChangeDetectionStrategy, Component, EventEmitter, OnDestroy, Output, signal} from '@angular/core';
import {FormBuilder, FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {runAfterCarbonModalClosed, TooltipModule, ValtimoCdsModalDirective} from '@valtimo/components';
import {BuildingBlockDefinitionDto, CaseProcessDefinitionResponseDto} from '@valtimo/shared';
import {ProcessLinkBuildingBlockApiService} from '@valtimo/process-link';
import {FlowModeler20, BlockStorageAlt20} from '@carbon/icons';
import {
  ButtonModule,
  ComboBoxModule,
  IconModule,
  IconService,
  LayerModule,
  LoadingModule,
  ModalModule,
  ProgressIndicatorModule,
} from 'carbon-components-angular';
import {catchError, combineLatest, EMPTY, map, Observable, of, Subscription} from 'rxjs';
import {
  BuildingBlockConfigRequest,
  CreateStartableItemRequest,
  ListItem,
  ManagementStartableItem,
  ModalStep,
  StartableItemType,
} from '../../../../../models';
import {StartableItemManagementService} from '../../../../../services';

@Component({
  standalone: true,
  selector: 'valtimo-case-management-actions-modal',
  templateUrl: './case-management-actions-modal.component.html',
  styleUrls: ['./case-management-actions-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ModalModule,
    ButtonModule,
    IconModule,
    LayerModule,
    ReactiveFormsModule,
    ComboBoxModule,
    ValtimoCdsModalDirective,
    TooltipModule,
    ProgressIndicatorModule,
    LoadingModule,
  ],
})
export class CaseManagementActionsModalComponent implements OnDestroy {
  @Output() public readonly configureBuildingBlockEvent = new EventEmitter<BuildingBlockConfigRequest>();

  public readonly showModal$ = this.stateService.showModal$;
  public readonly editingItem$ = this.stateService.editingItem$;

  public readonly $step = signal<ModalStep>('selectType');
  public readonly $selectedType = signal<StartableItemType | null>(null);
  public readonly $saving = signal(false);
  public readonly $loading = signal(false);
  public readonly $processItemsEmpty = signal(false);
  public readonly $buildingBlockItemsEmpty = signal(false);

  public readonly StartableItemType = StartableItemType;

  public readonly formGroup = this.fb.group({
    selectedItem: this.fb.control<string | null>(null, Validators.required),
  });

  public get selectedItemControl(): FormControl<string | null> {
    return this.formGroup.get('selectedItem') as FormControl<string | null>;
  }

  public readonly availableProcessItems$: Observable<ListItem[]> = combineLatest([
    this.stateService.linkedProcessDefinitions$.pipe(catchError(() => of([]))),
    this.stateService.usedProcessDefinitionIds$,
    this.stateService.editingItem$,
  ]).pipe(
    map(([definitions, usedIds, editingItem]) =>
      definitions
        .filter(
          (def: CaseProcessDefinitionResponseDto) =>
            !usedIds.includes(def.processDefinition.id) ||
            (editingItem?.type === StartableItemType.PROCESS &&
              editingItem?.processDefinitionId === def.processDefinition.id)
        )
        .map(
          (def: CaseProcessDefinitionResponseDto): ListItem => ({
            content: def.processDefinition.name || def.processDefinition.key,
            key: def.processDefinition.key,
            id: def.processDefinition.id,
            selected: editingItem?.processDefinitionId === def.processDefinition.id,
          })
        )
        .sort((a, b) => a.content.localeCompare(b.content))
    )
  );

  public readonly availableBuildingBlockItems$: Observable<ListItem[]> = combineLatest([
    this.buildingBlockApiService
      .getBuildingBlockDefinitions({includeArtwork: false})
      .pipe(catchError(() => of([]))),
    this.stateService.usedBuildingBlockKeys$,
    this.stateService.editingItem$,
  ]).pipe(
    map(([definitions, usedKeys, editingItem]) =>
      definitions
        .filter(
          (def: BuildingBlockDefinitionDto) =>
            !usedKeys.includes(def.key) ||
            (editingItem?.type === StartableItemType.BUILDING_BLOCK &&
              editingItem?.key === def.key)
        )
        .map(
          (def: BuildingBlockDefinitionDto): ListItem => ({
            content: def.name || def.key,
            key: def.key,
            id: def.key,
            selected: editingItem?.key === def.key,
            versionTag: def.versionTag,
          })
        )
        .sort((a, b) => a.content.localeCompare(b.content))
    )
  );

  private _buildingBlockItems: ListItem[] = [];
  private _editingItem: ManagementStartableItem | null = null;
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly stateService: StartableItemManagementService,
    private readonly buildingBlockApiService: ProcessLinkBuildingBlockApiService,
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([FlowModeler20, BlockStorageAlt20]);
    this._subscriptions.add(
      this.availableProcessItems$.subscribe(items => {
        this.$processItemsEmpty.set(items.length === 0);
      })
    );
    this._subscriptions.add(
      this.availableBuildingBlockItems$.subscribe(items => {
        this._buildingBlockItems = items;
        this.$buildingBlockItemsEmpty.set(items.length === 0);
      })
    );
    this._subscriptions.add(
      this.stateService.editingItem$.subscribe(item => {
        this._editingItem = item;
        if (item) {
          this.$selectedType.set(item.type);
          this.$step.set('selectItem');
          if (item.type === StartableItemType.PROCESS) {
            this.formGroup.patchValue({selectedItem: item.processDefinitionId});
          } else {
            this.formGroup.patchValue({selectedItem: item.key});
          }
        }
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public get isEditMode(): boolean {
    return this._editingItem !== null;
  }

  public get isBuildingBlockEdit(): boolean {
    return (
      this.isEditMode && this._editingItem?.type === StartableItemType.BUILDING_BLOCK
    );
  }

  public get modalTitle(): string {
    if (this.isEditMode) {
      return this._editingItem?.type === StartableItemType.PROCESS
        ? this.translateService.instant('caseManagement.actions.modal.editProcessTitle')
        : this.translateService.instant(
            'caseManagement.actions.modal.editBuildingBlockTitle'
          );
    }

    if (this.$step() === 'selectType') {
      return this.translateService.instant('caseManagement.actions.modal.addTitle');
    }

    return this.$selectedType() === StartableItemType.PROCESS
      ? this.translateService.instant('caseManagement.actions.modal.addProcessTitle')
      : this.translateService.instant('caseManagement.actions.modal.addBuildingBlockTitle');
  }

  public get modalDescription(): string {
    if (this.$step() === 'selectType') {
      return this.translateService.instant('caseManagement.actions.modal.addDescription');
    }

    return this.$selectedType() === StartableItemType.PROCESS
      ? this.translateService.instant('caseManagement.actions.modal.selectProcessDescription')
      : this.translateService.instant(
          'caseManagement.actions.modal.selectBuildingBlockDescription'
        );
  }

  public get primaryButtonLabel(): string {
    if (this.$step() === 'selectType') return '';
    if (this.$selectedType() === StartableItemType.BUILDING_BLOCK) {
      return this.translateService.instant('caseManagement.actions.modal.next');
    }
    if (this.isEditMode) {
      return this.translateService.instant('caseManagement.actions.modal.save');
    }
    return this.translateService.instant('caseManagement.actions.modal.add');
  }

  public onSelectType(type: StartableItemType): void {
    this.$selectedType.set(type);
    this.$step.set('selectItem');
    this.formGroup.reset();
  }

  public onComboBoxSelected(event: ListItem | null): void {
    if (event?.id) {
      this.formGroup.patchValue({selectedItem: event.id});
    } else {
      this.formGroup.patchValue({selectedItem: null});
    }
  }

  public onSubmit(): void {
    if (this.formGroup.invalid || this.$saving()) return;

    const selectedId = this.selectedItemControl.value;
    if (!selectedId) return;

    if (this.$selectedType() === StartableItemType.BUILDING_BLOCK) {
      this.configureBuildingBlockEvent.emit({
        buildingBlockDefinitionKey: selectedId,
        buildingBlockDefinitionVersionTag: this.getSelectedBuildingBlockVersionTag(selectedId),
      });
      this.onCloseModal();
      return;
    }

    this.$saving.set(true);

    if (this.isEditMode) {
      this.handleEdit();
    } else {
      this.handleCreate();
    }
  }

  public onCloseModal(): void {
    this.stateService.hideModal();
    this.resetState();
  }

  public onBack(): void {
    if (this.$step() === 'selectItem' && !this.isEditMode) {
      this.$step.set('selectType');
      this.$selectedType.set(null);
      this.formGroup.reset();
    }
  }

  private handleCreate(): void {
    const selectedId = this.selectedItemControl.value;
    if (!selectedId) return;

    const request: CreateStartableItemRequest =
      this.$selectedType() === StartableItemType.PROCESS
        ? {type: StartableItemType.PROCESS, properties: {processDefinitionId: selectedId}}
        : {
            type: StartableItemType.BUILDING_BLOCK,
            properties: {
              buildingBlockDefinitionKey: selectedId,
              buildingBlockDefinitionVersionTag: this.getSelectedBuildingBlockVersionTag(selectedId),
            },
          };

    this.stateService
      .createItem(request)
      .pipe(catchError(() => of(null)))
      .subscribe(result => {
        this.$saving.set(false);
        if (result) {
          this.stateService.hideModal();
          this.resetState();
          this.stateService.loadItems();
        }
      });
  }

  private handleEdit(): void {
    if (!this._editingItem) return;

    const selectedId = this.selectedItemControl.value;
    if (!selectedId) return;

    const request: CreateStartableItemRequest =
      this._editingItem.type === StartableItemType.PROCESS
        ? {
            type: StartableItemType.PROCESS,
            properties: {processDefinitionId: selectedId},
          }
        : {
            type: StartableItemType.BUILDING_BLOCK,
            properties: {
              buildingBlockDefinitionKey: selectedId,
              buildingBlockDefinitionVersionTag:
                this.getSelectedBuildingBlockVersionTag(selectedId),
            },
          };

    this.stateService
      .updateItem(this._editingItem.key, this._editingItem.versionTag, request)
      .pipe(
        catchError(() => {
          this.$saving.set(false);
          this.stateService.loadItems();
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.$saving.set(false);
        this.stateService.hideModal();
        this.resetState();
        this.stateService.loadItems();
      });
  }

  private getSelectedBuildingBlockVersionTag(key: string): string {
    return this._buildingBlockItems.find(item => item.key === key)?.versionTag ?? '';
  }

  private resetState(): void {
    runAfterCarbonModalClosed(() => {
      this.$step.set('selectType');
      this.$selectedType.set(null);
      this.$saving.set(false);
      this.formGroup.reset();
      this._editingItem = null;
    });
  }
}
