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

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {BehaviorSubject, combineLatest, Observable, of, startWith, Subscription} from 'rxjs';
import {filter, map, switchMap, take, withLatestFrom} from 'rxjs/operators';
import {
  BuildingBlockInputMapping,
  BuildingBlockOutputMapping,
  BuildingBlockProcessLinkCreateDto,
  BuildingBlockProcessLinkUpdateDto,
  BuildingBlockSyncTiming,
  InputRowFormGroup,
  InputsFormGroup,
  OutputRowFormGroup,
  OutputsFormGroup,
  ProcessLink,
} from '../../models';
import {
  BuildingBlockStateService,
  ProcessLinkBuildingBlockApiService,
  ProcessLinkButtonService,
  ProcessLinkService,
  ProcessLinkStateService,
  ProcessLinkStepService,
} from '../../services';
import {stripDocPrefix} from '../../utils';
import {
  ButtonModule,
  ComboBoxModule,
  IconModule,
  InputModule,
  LayerModule,
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
import {getBuildingBlockManagementRouteParams, getCaseManagementRouteParams} from '@valtimo/shared';
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
    LayerModule,
  ],
})
export class ConfigureBuildingBlockMappingsComponent implements OnInit, OnDestroy, AfterViewInit {
  public readonly buildingBlockFields$ = this.buildingBlockStateService.buildingBlockFields$;

  public readonly buildingBlockFieldItems$: Observable<Array<SelectItem>> =
    this.buildingBlockFields$.pipe(
      map(buildingBlockFields =>
        buildingBlockFields.map(buildingBlockField => {
          return {
            id: buildingBlockField.name,
            text: `doc:${buildingBlockField.name}`,
          };
        })
      )
    );

  public readonly inputsForm: InputsFormGroup = new FormGroup<InputsFormGroup['controls']>({
    inputs: new FormArray<InputRowFormGroup>([]),
  });
  public readonly outputsForm: OutputsFormGroup = new FormGroup<OutputsFormGroup['controls']>({
    outputs: new FormArray<OutputRowFormGroup>([]),
  });

  private readonly _rowItemsCache = new WeakMap<InputRowFormGroup, Observable<SelectItem[]>>();
  public getBuildingBlockFieldItemsForRow$(
    group: InputRowFormGroup
  ): Observable<Array<SelectItem>> {
    const cached = this._rowItemsCache.get(group);

    if (cached) return cached;

    const stream = combineLatest([
      this.buildingBlockFieldItems$,
      this.inputsForm.valueChanges.pipe(startWith(this.inputsForm.value)),
      group.valueChanges.pipe(startWith(group.value)),
    ]).pipe(
      map(([buildingBlockFieldItems, inputsFormValue, groupValue]) => {
        const usedInputTargets =
          inputsFormValue.inputs?.map(input => input.target).filter(Boolean) ?? [];

        return buildingBlockFieldItems.filter(item => {
          if (item.id === groupValue.target) return true;
          return !usedInputTargets.includes(`${item.id}`);
        });
      })
    );

    this._rowItemsCache.set(group, stream);

    return stream;
  }

  private readonly _outputTargetFiltersCache = new WeakMap<
    OutputRowFormGroup,
    Observable<string[]>
  >();
  public getUsedCaseTargetsForRow$(group: OutputRowFormGroup): Observable<string[]> {
    const cached = this._outputTargetFiltersCache.get(group);
    if (cached) return cached;

    const stream = combineLatest([
      this.outputsForm.valueChanges.pipe(startWith(this.outputsForm.value)),
      group.valueChanges.pipe(startWith(group.value)),
    ]).pipe(
      map(([outputsFormValue, groupValue]) => {
        const allTargets =
          outputsFormValue.outputs?.map(output => output.target).filter(Boolean) ?? [];

        return allTargets.filter(target => target !== groupValue.target);
      })
    );

    this._outputTargetFiltersCache.set(group, stream);

    return stream;
  }

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
  public readonly buildingBlockParams$ = getBuildingBlockManagementRouteParams(this.route);
  public readonly ValuePathSelectorPrefix = ValuePathSelectorPrefix;

  public readonly sourceIsCase$ = new BehaviorSubject<boolean>(true);
  public readonly sourceIsIndependent$ = new BehaviorSubject<boolean>(false);

  /**
   * Returns the name of the source/target context in mappings.
   * When in a building block context, shows the parent building block name.
   * When in a case context, shows the case name.
   * When in an independent process context, shows the process label.
   */
  public readonly sourceContextName$: Observable<string> = combineLatest([
    this.params$,
    this.buildingBlockParams$,
  ]).pipe(
    switchMap(([caseParams, bbParams]) => {
      if (bbParams?.buildingBlockDefinitionKey && bbParams?.buildingBlockDefinitionVersionTag) {
        this.sourceIsCase$.next(false);
        this.sourceIsIndependent$.next(false);
        // We're in a building block context - fetch the parent building block name
        return this.buildingBlockApiService
          .getBuildingBlockDefinition(
            bbParams.buildingBlockDefinitionKey,
            bbParams.buildingBlockDefinitionVersionTag
          )
          .pipe(map(def => def?.name ?? bbParams.buildingBlockDefinitionKey));
      } else if (caseParams?.caseDefinitionKey && caseParams?.caseDefinitionVersionTag) {
        this.sourceIsCase$.next(true);
        this.sourceIsIndependent$.next(false);
        // We're in a case context - fetch the case name
        return this.buildingBlockApiService
          .getCaseDefinition(caseParams.caseDefinitionKey, caseParams.caseDefinitionVersionTag)
          .pipe(map(def => def?.name ?? caseParams.caseDefinitionKey));
      }
      // We're in an independent process context
      this.sourceIsCase$.next(false);
      this.sourceIsIndependent$.next(true);
      return of(this.translateService.instant('processLinkConfiguration.buildingBlock.process'));
    })
  );

  /**
   * Returns the name of the building block being configured.
   */
  public readonly targetBuildingBlockName$: Observable<string> = combineLatest([
    this.buildingBlockStateService.definitionKey$,
    this.buildingBlockStateService.definitionVersionTag$,
  ]).pipe(
    switchMap(([key, versionTag]) => {
      if (key && versionTag) {
        return this.buildingBlockApiService
          .getBuildingBlockDefinition(key, versionTag)
          .pipe(map(def => def?.name ?? key));
      }
      return of(
        this.translateService.instant('processLinkConfiguration.buildingBlock.buildingBlock')
      );
    })
  );

  private readonly _subscriptions = new Subscription();
  private _syncingFromState = false;
  private _suppressValidation = false;
  private _inputRefreshHandle: number | null = null;
  private _destroyed = false;

  public get inputs(): FormArray<InputRowFormGroup> {
    return this.inputsForm.controls.inputs;
  }

  public get outputs(): FormArray<OutputRowFormGroup> {
    return this.outputsForm.controls.outputs;
  }

  public readonly allInputsMapped$: Observable<boolean> = combineLatest([
    this.buildingBlockFields$,
    this.inputsForm.valueChanges.pipe(startWith(this.inputsForm.value)),
  ]).pipe(
    map(([fields, inputsFormValue]) => {
      const allTargets =
        inputsFormValue.inputs?.map(input => input.target).filter((t): t is string => !!t) ?? [];

      if (!fields || fields.length === 0) {
        return false;
      }

      return fields.every(field => allTargets.includes(field.name));
    })
  );

  constructor(
    private readonly fb: FormBuilder,
    private readonly buildingBlockStateService: BuildingBlockStateService,
    private readonly buttonService: ProcessLinkButtonService,
    private readonly stepService: ProcessLinkStepService,
    private readonly processLinkService: ProcessLinkService,
    private readonly processLinkStateService: ProcessLinkStateService,
    private readonly translateService: TranslateService,
    private readonly route: ActivatedRoute,
    private readonly changeDetectorRef: ChangeDetectorRef,
    private readonly buildingBlockApiService: ProcessLinkBuildingBlockApiService,
    private readonly stateService: ProcessLinkStateService
  ) {}

  ngOnInit(): void {
    this._subscriptions.add(
      combineLatest([
        this.buildingBlockFields$,
        this.buildingBlockStateService.inputMappings$,
      ]).subscribe(([fields, mappings]) => {
        this.syncInputsIfNeeded(fields, mappings);
      })
    );

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
      this.buttonService.backButtonClick$
        .pipe(
          withLatestFrom(this.stateService.isEditing$),
          filter(([, isEditing]) => !isEditing)
        )
        .subscribe(() => {
          this.stepService.setConfigureBuildingBlockPluginsStep();
        })
    );

    this._subscriptions.add(
      this.buttonService.saveButtonClick$.subscribe(() => {
        this.persistProcessLink();
      })
    );

    this._subscriptions.add(
      this.outputsForm.valueChanges.subscribe(() => {
        this.persistOutputFormState();
      })
    );

    this._subscriptions.add(
      this.inputsForm.valueChanges.subscribe(() => {
        this.persistInputFormState();
      })
    );
  }

  public ngAfterViewInit(): void {
    this.queueInputSourceRefresh();
  }

  public ngOnDestroy(): void {
    this._destroyed = true;
    if (this._inputRefreshHandle !== null) {
      clearTimeout(this._inputRefreshHandle);
      this._inputRefreshHandle = null;
    }
    this._subscriptions.unsubscribe();
  }

  private createInputGroup(mapping?: BuildingBlockInputMapping): InputRowFormGroup {
    return new FormGroup<InputRowFormGroup['controls']>({
      source: new FormControl(mapping?.source ?? '', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      target: new FormControl(mapping?.target ?? '', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    });
  }

  private createOutputGroup(
    mapping?: BuildingBlockOutputMapping,
    sourceOverride?: string
  ): OutputRowFormGroup {
    return new FormGroup<OutputRowFormGroup['controls']>({
      source: new FormControl(sourceOverride ?? mapping?.source ?? '', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      target: new FormControl(mapping?.target ?? '', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      syncTiming: new FormControl<BuildingBlockSyncTiming>(
        (mapping?.syncTiming as BuildingBlockSyncTiming) ?? ('END' as BuildingBlockSyncTiming),
        {nonNullable: true, validators: [Validators.required]}
      ),
    });
  }

  public addInput(): void {
    this.inputs.push(this.createInputGroup());
    this.persistInputFormState();
    this.changeDetectorRef.detectChanges();
  }

  public deleteInput(index: number): void {
    this.inputs.removeAt(index);
    this.persistInputFormState();
    this.changeDetectorRef.detectChanges();
  }

  public addOutput(source?: string): void {
    this.outputs.push(this.createOutputGroup(undefined, source));
    this.persistOutputFormState();
    this.changeDetectorRef.detectChanges();
  }

  public deleteOutput(index: number): void {
    this.outputs.removeAt(index);
    this.persistOutputFormState();
  }

  private syncInputsFromState(
    fields: Array<{name: string; required: boolean}>,
    mappings: BuildingBlockInputMapping[]
  ): void {
    this._syncingFromState = true;
    const normalizedMappings = mappings.map(m => ({
      ...m,
      target: stripDocPrefix(m.target),
    }));
    const requiredTargets = fields.filter(f => f.required).map(f => f.name);
    const allMappings: BuildingBlockInputMapping[] = [
      ...requiredTargets.map(
        target =>
          normalizedMappings.find(m => m.target === target) || {target: target, source: ''}
      ),
      ...normalizedMappings.filter(mapping => !requiredTargets.includes(mapping.target)),
    ];

    this.inputs.clear();
    allMappings.forEach(mapping => {
      this.inputs.push(this.createInputGroup(mapping));
    });
    this._syncingFromState = false;
    this.triggerValidation();
    this.queueInputSourceRefresh();
  }

  private syncInputsIfNeeded(
    fields: Array<{name: string; required: boolean}>,
    mappings: BuildingBlockInputMapping[]
  ): void {
    if (this._syncingFromState) {
      return;
    }

    const requiredTargets = fields.filter(f => f.required).map(f => f.name);
    const currentTargets =
      this.inputs.controls
        .map(group => group.controls.target.value)
        .filter((target): target is string => !!target) ?? [];
    const missingRequired = requiredTargets.some(target => !currentTargets.includes(target));
    const shouldSync =
      (this.inputs.length === 0 && (mappings.length > 0 || fields.length > 0)) || missingRequired;

    if (shouldSync) {
      this.syncInputsFromState(fields, mappings);
      return;
    }

    this.applyMappingSources(mappings);
  }

  private applyMappingSources(mappings: BuildingBlockInputMapping[]): void {
    const mappingByTarget = new Map<string, BuildingBlockInputMapping>(
      mappings
        .filter(mapping => !!mapping.target)
        .map(mapping => [stripDocPrefix(mapping.target), mapping])
    );
    let updated = false;

    this._syncingFromState = true;
    this.inputs.controls.forEach(group => {
      const target = group.controls.target.value;
      if (!target) return;
      const mapping = mappingByTarget.get(target);
      if (!mapping?.source) return;
      if (!group.controls.source.value) {
        group.controls.source.setValue(mapping.source);
        updated = true;
      }
    });
    this._syncingFromState = false;

    if (updated) {
      this.triggerValidation();
      this.queueInputSourceRefresh();
    }
  }

  private queueInputSourceRefresh(): void {
    if (this._inputRefreshHandle !== null) {
      clearTimeout(this._inputRefreshHandle);
    }
    this._inputRefreshHandle = window.setTimeout(() => {
      if (this._destroyed) return;
      this.inputs.controls.forEach(group => {
        const value = group.controls.source.value ?? '';
        group.controls.source.setValue(value, {emitEvent: false});
      });
      this.changeDetectorRef.detectChanges();
      this._inputRefreshHandle = null;
    }, 0);
  }

  public isSyncTimingSelected(group: OutputRowFormGroup, value: BuildingBlockSyncTiming): boolean {
    return group.controls.syncTiming.value === value;
  }

  private syncOutputsFromState(mappings: BuildingBlockOutputMapping[]): void {
    this._syncingFromState = true;
    this.outputs.clear();
    (mappings || []).forEach(mapping => {
      const normalizedMapping = {
        ...mapping,
        source: stripDocPrefix(mapping.source),
      };
      this.outputs.push(this.createOutputGroup(normalizedMapping));
    });
    this._syncingFromState = false;
    this.triggerValidation();
  }

  private persistInputFormState(): void {
    if (this._syncingFromState) {
      return;
    }
    const mapped: Array<BuildingBlockInputMapping> = this.inputs.controls.map(group => {
      return {source: group.value.source, target: group.value.target} as BuildingBlockInputMapping;
    });
    this.buildingBlockStateService.setInputMappings(mapped);
    this.triggerValidation();
  }

  private persistOutputFormState(): void {
    if (this._syncingFromState) {
      return;
    }
    const mapped: Array<BuildingBlockOutputMapping> = this.outputs.controls.map(group => {
      return {
        source: group.value.source,
        target: group.value.target,
        syncTiming: (group.value.syncTiming ?? 'END') as BuildingBlockSyncTiming,
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

    this.inputs.controls.forEach(group => {
      const target = group.controls.target.value || '';
      const source = group.controls.source.value || '';
      if (target) {
        targetCounts[target] = (targetCounts[target] || 0) + 1;
      }
      if (!source) {
        group.controls.source.setErrors({required: true});
        valid = false;
      }
      if (!target) {
        group.controls.target.setErrors({required: true});
        valid = false;
      }
    });

    Object.entries(targetCounts).forEach(([target, count]) => {
      if (count > 1) {
        this.inputs.controls
          .filter(g => g.controls.target.value === target)
          .forEach(g => g.controls.target.setErrors({duplicateTarget: true}));
        valid = false;
      }
    });

    requiredTargets.forEach(reqTarget => {
      const match = this.inputs.controls.find(g => g.controls.target.value === reqTarget);
      if (!match || !match.controls.source.value) {
        valid = false;
      }
    });

    return valid;
  }

  private validateOutputs(): boolean {
    let valid = true;
    const targetCounts: Record<string, number> = {};

    this.outputs.controls.forEach(group => {
      const target = group.controls.target.value || '';
      const source = group.controls.source.value || '';
      const syncTiming = group.controls.syncTiming.value;
      if (target) {
        targetCounts[target] = (targetCounts[target] || 0) + 1;
      }
      if (!source) {
        group.controls.source.setErrors({required: true});
        valid = false;
      }
      if (!target) {
        group.controls.target.setErrors({required: true});
        valid = false;
      }
      if (!syncTiming) {
        group.controls.syncTiming.setErrors({required: true});
        valid = false;
      }
    });

    Object.entries(targetCounts).forEach(([target, count]) => {
      if (count > 1) {
        this.outputs.controls
          .filter(g => g.controls.target.value === target)
          .forEach(g => g.controls.target.setErrors({duplicateTarget: true}));
        valid = false;
      }
    });

    return valid;
  }

  private clearCustomErrors(): void {
    this.inputs.controls.forEach(group => {
      group.controls.source.setErrors(null);
      group.controls.target.setErrors(null);
    });
    this.outputs.controls.forEach(group => {
      group.controls.source.setErrors(null);
      group.controls.target.setErrors(null);
      group.controls.syncTiming.setErrors(null);
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

      if (!activityId) {
        this.processLinkStateService.stopSaving();
        return;
      }

      const request: BuildingBlockProcessLinkCreateDto = {
        processDefinitionId: modalParams.processDefinitionId ?? '-',
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

      this.processLinkStateService.sendProcessLinkCreateEvent(request);
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

      this.processLinkStateService.sendProcessLinkUpdateEvent(request);
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
