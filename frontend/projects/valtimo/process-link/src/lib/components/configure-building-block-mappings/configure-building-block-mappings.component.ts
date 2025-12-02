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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {combineLatest, Observable, Subscription} from 'rxjs';
import {map, take} from 'rxjs/operators';
import {
  BuildingBlockInputMapping,
  BuildingBlockOutputMapping,
  BuildingBlockProcessLinkCreateDto,
  BuildingBlockProcessLinkUpdateDto,
  BuildingBlockSyncTiming,
  ProcessLink,
  ProcessLinkEditMode,
} from '../../models';
import {
  BuildingBlockStateService,
  ProcessLinkButtonService,
  ProcessLinkService,
  ProcessLinkStateService,
  ProcessLinkStepService,
} from '../../services';
import {
  ButtonModule,
  ComboBoxModule,
  IconModule,
  InputModule,
  RadioModule,
} from 'carbon-components-angular';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  InputLabelModule,
  SelectItem,
  SelectModule,
  ValuePathSelectorComponent,
  ValuePathSelectorPrefix,
} from '@valtimo/components';
import {getCaseManagementRouteParams} from '@valtimo/shared';
import {ActivatedRoute} from '@angular/router';

@Component({
  standalone: true,
  selector: 'valtimo-configure-building-block-mappings',
  templateUrl: './configure-building-block-mappings.component.html',
  styleUrls: ['./configure-building-block-mappings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ComboBoxModule,
    RadioModule,
    InputModule,
    ValuePathSelectorComponent,
    InputLabelModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    SelectModule,
  ],
})
export class ConfigureBuildingBlockMappingsComponent implements OnInit, OnDestroy {
  public readonly buildingBlockFields$ = this.buildingBlockStateService.buildingBlockFields$;

  public readonly buildingBlockFieldItems$: Observable<Array<SelectItem>> =
    this.buildingBlockFields$.pipe(
      map(buildingBlockFields =>
        buildingBlockFields.map(buildingBlockField => {
          return {
            id: buildingBlockField.name,
            text: buildingBlockField.name,
          };
        })
      )
    );

  public readonly inputsForm = this.fb.group({
    inputs: this.fb.array<FormGroup>([]),
  });
  public readonly outputsForm = this.fb.group({
    outputs: this.fb.array<FormGroup>([]),
  });

  public readonly syncTimingItems: Array<{id: BuildingBlockSyncTiming; labelKey: string}> = [
    {
      id: 'CONTINUOUS' as BuildingBlockSyncTiming,
      labelKey: 'processLinkConfiguration.buildingBlock.sync.continuous',
    },
    {
      id: 'END' as BuildingBlockSyncTiming,
      labelKey: 'processLinkConfiguration.buildingBlock.sync.end',
    },
  ];

  public readonly params$ = getCaseManagementRouteParams(this.route);
  public readonly ValuePathSelectorPrefix = ValuePathSelectorPrefix;

  private readonly _subscriptions = new Subscription();
  private _syncingFromState = false;
  private _suppressValidation = false;

  get inputs(): FormArray<FormGroup> {
    return this.inputsForm.get('inputs') as FormArray<FormGroup>;
  }

  get outputs(): FormArray<FormGroup> {
    return this.outputsForm.get('outputs') as FormArray<FormGroup>;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly buildingBlockStateService: BuildingBlockStateService,
    private readonly buttonService: ProcessLinkButtonService,
    private readonly stepService: ProcessLinkStepService,
    private readonly processLinkService: ProcessLinkService,
    private readonly processLinkStateService: ProcessLinkStateService,
    private readonly translateService: TranslateService,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    combineLatest([this.buildingBlockFields$, this.buildingBlockStateService.inputMappings$])
      .pipe(take(1))
      .subscribe(([fields, mappings]) => {
        this.syncInputsFromState(fields, mappings);
      });

    this.buildingBlockStateService.outputMappings$.pipe(take(1)).subscribe(mappings => {
      this.syncOutputsFromState(mappings);
    });

    this._subscriptions.add(
      combineLatest([this.inputsForm.statusChanges, this.outputsForm.statusChanges]).subscribe(
        () => {
          this.triggerValidation();
        }
      )
    );
    this.triggerValidation();

    this._subscriptions.add(
      this.buttonService.backButtonClick$.subscribe(() => {
        this.stepService.setConfigureBuildingBlockPluginsStep();
      })
    );

    this._subscriptions.add(
      this.buttonService.saveButtonClick$.subscribe(() => {
        this.persistProcessLink();
      })
    );
    this._subscriptions.add(
      this.outputsForm.valueChanges.subscribe(changes => {
        this.persistOutputFormState();
      })
    );

    this._subscriptions.add(
      this.inputsForm.valueChanges.subscribe(changes => {
        this.persistInputFormState();
      })
    );
  }

  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public addInput(): void {
    this.inputs.push(
      this.fb.group({
        source: ['', Validators.required],
        target: ['', Validators.required],
      })
    );
    this.persistInputFormState();
  }

  public deleteInput(index: number): void {
    this.inputs.removeAt(index);
    this.persistInputFormState();
  }

  public addOutput(source?: string): void {
    this.outputs.push(
      this.fb.group({
        source: [source ?? '', Validators.required],
        target: ['', Validators.required],
        syncTiming: ['END' as BuildingBlockSyncTiming, Validators.required],
      })
    );
    this.persistOutputFormState();
  }

  public deleteOutput(index: number): void {
    this.outputs.removeAt(index);
    this.persistOutputFormState();
  }

  public syncTimingLabel(item: {id: BuildingBlockSyncTiming; labelKey: string}): string {
    return this.translateService.instant(item.labelKey);
  }

  private syncInputsFromState(
    fields: Array<{name: string; required: boolean}>,
    mappings: BuildingBlockInputMapping[]
  ): void {
    this._syncingFromState = true;
    const requiredTargets = fields.filter(f => f.required).map(f => f.name);
    const allMappings: BuildingBlockInputMapping[] = [
      ...requiredTargets.map(
        target => mappings.find(m => m.target === target) || {target: target, source: ''}
      ),
      ...mappings.filter(mapping => !requiredTargets.includes(mapping.target)),
    ];

    this.inputs.clear();
    allMappings.forEach(mapping => {
      this.inputs.push(
        this.fb.group({
          source: [mapping.source ?? '', Validators.required],
          target: [mapping.target ?? '', Validators.required],
        })
      );
    });
    this._syncingFromState = false;
    this.triggerValidation();
  }

  private syncOutputsFromState(mappings: BuildingBlockOutputMapping[]): void {
    this._syncingFromState = true;
    this.outputs.clear();
    (mappings || []).forEach(mapping => {
      this.outputs.push(
        this.fb.group({
          source: [mapping.source ?? '', Validators.required],
          target: [mapping.target ?? '', Validators.required],
          syncTiming: [
            (mapping.syncTiming as BuildingBlockSyncTiming) ?? 'END',
            Validators.required,
          ],
        })
      );
    });
    this._syncingFromState = false;
    this.triggerValidation();
  }

  private persistInputFormState(): void {
    if (this._syncingFromState) {
      return;
    }
    const mapped: Array<BuildingBlockInputMapping> = this.inputs.controls.map(group => {
      const value = group.value;
      return {source: value.source, target: value.target} as BuildingBlockInputMapping;
    });
    this.buildingBlockStateService.setInputMappings(mapped);
    this.triggerValidation();
  }

  private persistOutputFormState(): void {
    if (this._syncingFromState) {
      return;
    }
    const mapped: Array<BuildingBlockOutputMapping> = this.outputs.controls.map(group => {
      const value = group.value;
      return {
        source: value.source,
        target: value.target,
        syncTiming: (value.syncTiming ?? 'END') as BuildingBlockSyncTiming,
      } as BuildingBlockOutputMapping;
    });
    this.buildingBlockStateService.setOutputMappings(mapped);
    this.triggerValidation();
  }

  private isValid(): boolean {
    const fields = this.buildingBlockStateService.getBuildingBlockFieldsSnapshot();
    this.clearCustomErrors();
    const inputsValid = this.validateInputs(fields);
    const outputsValid = this.validateOutputs();
    const overall = this.inputsForm.valid && this.outputsForm.valid && inputsValid && outputsValid;
    this.buttonService[overall ? 'enableSaveButton' : 'disableSaveButton']();
    return overall;
  }

  private validateInputs(fields: Array<{name: string; required: boolean}>): boolean {
    let valid = true;
    const requiredTargets = new Set(fields.filter(f => f.required).map(f => f.name));
    const targetCounts: Record<string, number> = {};

    // validate each row has been filled
    this.inputs.controls.forEach(group => {
      const target = group.get('target')?.value || '';
      const source = group.get('source')?.value || '';
      if (target) {
        targetCounts[target] = (targetCounts[target] || 0) + 1;
      }
      if (!source) {
        group.get('source')?.setErrors({required: true});
        valid = false;
      }
      if (!target) {
        group.get('target')?.setErrors({required: true});
        valid = false;
      }
    });

    // validate there's not multiple mappings to the same target
    Object.entries(targetCounts).forEach(([target, count]) => {
      if (count > 1) {
        this.inputs.controls
          .filter(g => g.get('target')?.value === target)
          .forEach(g => g.get('target')?.setErrors({duplicateTarget: true}));
        valid = false;
      }
    });

    // validate all required target have been configured
    requiredTargets.forEach(reqTarget => {
      const match = this.inputs.controls.find(g => g.get('target')?.value === reqTarget);
      if (!match || !match.get('source')?.value) {
        valid = false;
      }
    });

    return valid;
  }

  private validateOutputs(): boolean {
    let valid = true;
    const targetCounts: Record<string, number> = {};

    // validate each row has been filled
    this.outputs.controls.forEach(group => {
      const target = group.get('target')?.value || '';
      const source = group.get('source')?.value || '';
      const syncTiming = group.get('syncTiming')?.value;
      if (target) {
        targetCounts[target] = (targetCounts[target] || 0) + 1;
      }
      if (!source) {
        group.get('source')?.setErrors({required: true});
        valid = false;
      }
      if (!target) {
        group.get('target')?.setErrors({required: true});
        valid = false;
      }
      if (!syncTiming) {
        group.get('syncTiming')?.setErrors({required: true});
        valid = false;
      }
    });

    // validate there's not multiple mappings to the same target
    Object.entries(targetCounts).forEach(([target, count]) => {
      if (count > 1) {
        this.outputs.controls
          .filter(g => g.get('target')?.value === target)
          .forEach(g => g.get('target')?.setErrors({duplicateTarget: true}));
        valid = false;
      }
    });

    return valid;
  }

  private clearCustomErrors(): void {
    this.inputs.controls.forEach(group => {
      group.get('source')?.setErrors(null);
      group.get('target')?.setErrors(null);
    });
    this.outputs.controls.forEach(group => {
      group.get('source')?.setErrors(null);
      group.get('target')?.setErrors(null);
      group.get('syncTiming')?.setErrors(null);
    });
  }

  private triggerValidation(): void {
    if (this._suppressValidation) return;
    this._suppressValidation = true;
    Promise.resolve().then(() => {
      this.isValid();
      this._suppressValidation = false;
    });
  }

  private persistProcessLink(): void {
    if (!this.isValid()) {
      this.buttonService.disableSaveButton();
      return;
    }
    this.buttonService.disableSaveButton();
    this.processLinkStateService.startSaving();
    this.processLinkStateService.selectedProcessLink$
      .pipe(take(1))
      .subscribe(selectedProcessLink => {
        if (selectedProcessLink && selectedProcessLink.processLinkType === 'building-block') {
          this.updateProcessLink(selectedProcessLink);
        } else {
          this.createProcessLink();
        }
      });
  }

  private createProcessLink(): void {
    this.processLinkStateService.modalParams$.pipe(take(1)).subscribe(modalParams => {
      const {key, versionTag} = this.buildingBlockStateService.getDefinitionSnapshot();
      if (!modalParams || !key || !versionTag) {
        this.processLinkStateService.stopSaving();
        return;
      }
      const activityId = modalParams.element?.id;
      const processDefinitionId = modalParams.processDefinitionId;
      if (!activityId || !processDefinitionId) {
        this.processLinkStateService.stopSaving();
        return;
      }

      const request: BuildingBlockProcessLinkCreateDto = {
        processDefinitionId,
        activityId,
        activityType: modalParams.element?.activityListenerType ?? '',
        processLinkType: 'building-block',
        buildingBlockDefinitionKey: key,
        buildingBlockDefinitionVersionTag: versionTag,
        pluginConfigurationMappings:
          this.buildingBlockStateService.getPluginConfigurationMappingsSnapshot() as Record<
            string,
            string
          >,
        inputMappings: this.buildingBlockStateService.getInputMappingsSnapshot(),
        outputMappings: this.buildingBlockStateService.getOutputMappingsSnapshot(),
      };

      if (this.processLinkStateService.processLinkEditMode === ProcessLinkEditMode.EMIT_EVENTS) {
        this.processLinkStateService.sendProcessLinkCreateEvent(request);
        return;
      }

      this.processLinkService.saveProcessLink(request).subscribe({
        next: () => this.processLinkStateService.closeModal(),
        error: () => this.processLinkStateService.stopSaving(),
      });
    });
  }

  private updateProcessLink(processLink: ProcessLink): void {
    this.processLinkStateService.modalParams$.pipe(take(1)).subscribe(modalParams => {
      const {key, versionTag} = this.buildingBlockStateService.getDefinitionSnapshot();
      if (!modalParams || !key || !versionTag) {
        this.processLinkStateService.stopSaving();
        return;
      }

      const activityId = modalParams.element?.id;

      const request: BuildingBlockProcessLinkUpdateDto = {
        id: processLink.id,
        activityId: activityId,
        processLinkType: 'building-block',
        buildingBlockDefinitionKey: key,
        buildingBlockDefinitionVersionTag: versionTag,
        pluginConfigurationMappings:
          this.buildingBlockStateService.getPluginConfigurationMappingsSnapshot() as Record<
            string,
            string
          >,
        inputMappings: this.buildingBlockStateService.getInputMappingsSnapshot(),
        outputMappings: this.buildingBlockStateService.getOutputMappingsSnapshot(),
      };

      if (this.processLinkStateService.processLinkEditMode === ProcessLinkEditMode.EMIT_EVENTS) {
        this.processLinkStateService.sendProcessLinkUpdateEvent(request);
        return;
      }

      this.processLinkService.updateProcessLink(request).subscribe({
        next: () => this.processLinkStateService.closeModal(),
        error: () => this.processLinkStateService.stopSaving(),
      });
    });
  }

  public isRequiredTarget(
    fields: Array<{name: string; required: boolean}> | null,
    target: string
  ): boolean {
    if (!fields) return false;
    return fields.some(field => field.required && field.name === target);
  }
}
