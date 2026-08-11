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
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {Add16, TrashCan16} from '@carbon/icons';
import {
  ButtonModule,
  CheckboxModule,
  IconModule,
  IconService,
  InputModule,
  SelectModule,
} from 'carbon-components-angular';
import {ProcessService} from '@valtimo/process';
import {ValuePathSelectorComponent, ValuePathSelectorPrefix} from '@valtimo/components';
import {forkJoin, of, Subscription} from 'rxjs';
import {catchError, debounceTime} from 'rxjs/operators';
import {BUILDING_BLOCK_MANAGEMENT_MIGRATION_TEST_IDS} from '../../../constants';
import {BuildingBlockMigrationApiService} from '../../../services';
import {
  DataMigrationTargetType,
  ProcessMigrationInstruction,
  ProcessVariablePatch,
  ValuePathContext,
} from '../../../models';

/** How the left ("from") side of a variable patch is filled: copy a field, set a literal, or null. */
type PatchMode = 'path' | 'value' | 'null';

interface FlowNodeOption {
  id: string;
  label: string;
}

interface InstructionActivities {
  sourceNodes: FlowNodeOption[];
  targetNodes: FlowNodeOption[];
  loading: boolean;
}

@Component({
  standalone: true,
  selector: 'valtimo-bb-migration-process-migration-tab',
  templateUrl: './migration-process-migration-tab.component.html',
  styleUrls: ['./migration-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ButtonModule,
    CheckboxModule,
    IconModule,
    InputModule,
    SelectModule,
    ValuePathSelectorComponent,
  ],
})
export class BbMigrationProcessMigrationTabComponent implements OnInit, OnChanges, OnDestroy {
  // Used to build the migration endpoint URL for the activity-mapping suggestion.
  @Input() public buildingBlockDefinitionKey: string | null = null;
  @Input() public buildingBlockDefinitionVersionTag: string | null = null;

  /**
   * Document context for the `setProcessVariables` source value-path selector — the SAME context the
   * data-migration tab uses for its source, so both read from the same building block document. The
   * target is a plain `pv:` path (a free-text input), so it needs no context.
   */
  @Input() public sourceContext: ValuePathContext | null = null;

  /**
   * When set, the source / target process pickers only offer these processes (linked to the relevant
   * building block version) instead of every deployed process, and the maps' `key -> definitionId`
   * drive the activity lookups so each side's activities come from the CORRECT version's definition
   * (source = predecessor version, target = own version). `null` falls back to all deployed processes
   * / the latest definition per key.
   */
  @Input() public sourceProcessDefinitions: Record<string, string> | null = null;
  @Input() public targetProcessDefinitions: Record<string, string> | null = null;
  /** Intro text above the instructions. Hosts that already explain the direction pass `null` to hide it. */
  @Input() public descriptionKey: string | null =
    'buildingBlockManagement.migration.editor.processMigration.description';

  @Input() public set instructions(value: ProcessMigrationInstruction[] | null | undefined) {
    this.writeInstructions(value ?? []);
  }

  @Output() public readonly instructionsChange = new EventEmitter<ProcessMigrationInstruction[]>();

  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_MIGRATION_TEST_IDS;

  public readonly SOURCE_PREFIXES = [ValuePathSelectorPrefix.DOC];

  public readonly MODES: PatchMode[] = ['path', 'value', 'null'];

  public readonly TARGET_TYPES: DataMigrationTargetType[] = [
    'string',
    'integer',
    'long',
    'number',
    'double',
    'boolean',
  ];

  public processDefinitionKeys: string[] = [];

  public readonly form = this.fb.group({
    instructions: this.fb.array<FormGroup>([]),
  });

  private readonly _keyToLatestId = new Map<string, string>();
  private readonly _activities = new Map<FormGroup, InstructionActivities>();
  // Per instruction: incompatible source activity id -> engine failure messages (as judged live).
  private readonly _invalidMappings = new Map<FormGroup, Record<string, string[]>>();
  private _lastEmitted = '[]';
  private readonly _subscriptions = new Subscription();

  public get instructionsArray(): FormArray {
    return this.form.get('instructions') as FormArray;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly cdr: ChangeDetectorRef,
    private readonly iconService: IconService,
    private readonly processService: ProcessService,
    private readonly buildingBlockMigrationApiService: BuildingBlockMigrationApiService
  ) {
    this.iconService.registerAll([Add16, TrashCan16]);
  }

  public ngOnInit(): void {
    this.processService.getProcessDefinitions().subscribe(definitions => {
      const keys = new Set<string>();
      definitions.forEach(definition => {
        keys.add(definition.key);
        // The endpoint returns the latest deployed version per key; keep its id for activity lookups.
        this._keyToLatestId.set(definition.key, definition.id);
      });
      this.processDefinitionKeys = Array.from(keys).sort();
      // Load activities for instructions that were restored before the definitions were available.
      this.instructionsArray.controls.forEach(control => this.loadActivities(control as FormGroup));
      this.cdr.markForCheck();
      // The process-definition <option>s only exist now, so re-sync the selects with their values.
      this.reapplySelections();
    });

    this._subscriptions.add(this.form.valueChanges.subscribe(() => this.emit()));
  }

  public ngOnChanges(changes: SimpleChanges): void {
    // The scoping maps arrive asynchronously; when they do, re-resolve each instruction's activities
    // so the flow-node lists come from the now-known (correct-version) process definition ids.
    if (changes['sourceProcessDefinitions'] || changes['targetProcessDefinitions']) {
      this.instructionsArray.controls.forEach(control => this.loadActivities(control as FormGroup));
    }
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public activitiesFor(group: FormGroup): InstructionActivities {
    return this._activities.get(group) ?? {sourceNodes: [], targetNodes: [], loading: false};
  }

  /**
   * The engine's failure messages for one mapping row (looked up by its source activity), or an empty
   * array when the pair is a valid migration. Drives the inline "incompatible mapping" feedback so the
   * user cannot silently map incompatible activity types; the plan save rejects them server-side too.
   */
  public mappingErrors(group: FormGroup, mapping: AbstractControl): string[] {
    const source = mapping.get('source')?.value;
    return (source && this._invalidMappings.get(group)?.[source]) || [];
  }

  /**
   * Keys offered in this instruction's source (or target) process picker: the allowed (building-
   * block-linked) keys for that side — or all deployed keys when unscoped — plus this instruction's
   * own stored key so a restored plan referencing a now-unlinked process still shows its selection.
   */
  public processKeyOptions(group: FormGroup, side: 'source' | 'target'): string[] {
    const scoped = side === 'source' ? this.sourceProcessDefinitions : this.targetProcessDefinitions;
    const base = scoped ? Object.keys(scoped) : this.processDefinitionKeys;
    const stored = group.get(`${side}ProcessDefinitionKey`)?.value;
    return stored ? Array.from(new Set([...base, stored])) : Array.from(new Set(base));
  }

  public mapActivitiesArray(group: FormGroup): FormArray {
    return group.get('mapActivities') as FormArray;
  }

  public setProcessVariablesArray(group: FormGroup): FormArray {
    return group.get('setProcessVariables') as FormArray;
  }

  public addInstruction(): void {
    this.instructionsArray.push(this.createInstructionGroup());
  }

  public removeInstruction(index: number): void {
    const group = this.instructionsArray.at(index) as FormGroup;
    this._activities.delete(group);
    this._invalidMappings.delete(group);
    this.instructionsArray.removeAt(index);
  }

  public addMapping(group: FormGroup): void {
    this.mapActivitiesArray(group).push(this.createMappingGroup());
  }

  public removeMapping(group: FormGroup, index: number): void {
    this.mapActivitiesArray(group).removeAt(index);
  }

  public addVariable(group: FormGroup): void {
    this.setProcessVariablesArray(group).push(this.createVariableGroup());
  }

  public removeVariable(group: FormGroup, index: number): void {
    this.setProcessVariablesArray(group).removeAt(index);
  }

  private createInstructionGroup(instruction?: ProcessMigrationInstruction): FormGroup {
    const group = this.fb.group({
      sourceProcessDefinitionKey: this.fb.control(instruction?.sourceProcessDefinitionKey ?? ''),
      targetProcessDefinitionKey: this.fb.control(instruction?.targetProcessDefinitionKey ?? ''),
      mapActivities: this.fb.array<FormGroup>(
        Object.entries(instruction?.mapActivities ?? {}).map(([source, target]) =>
          this.createMappingGroup(source, target)
        )
      ),
      setProcessVariables: this.fb.array<FormGroup>(
        (instruction?.setProcessVariables ?? []).map(patch => this.createVariableGroup(patch))
      ),
      skipCustomListeners: this.fb.control(instruction?.skipCustomListeners ?? false),
      skipIoMappings: this.fb.control(instruction?.skipIoMappings ?? false),
    });

    const sourceControl = group.get('sourceProcessDefinitionKey')!;
    const targetControl = group.get('targetProcessDefinitionKey')!;

    // When the user picks a different source/target process, reload the selectable activities AND
    // re-suggest the activity mapping for the new pair.
    this._subscriptions.add(
      sourceControl.valueChanges.subscribe(value => {
        // Convenience: migrating a process to a new version of itself is the common case, so when
        // the target is still empty, mirror the chosen source onto it (setValue fires the target
        // subscription below, which handles the reload + suggestion).
        if (value && !targetControl.value) targetControl.setValue(value);
        else this.onProcessChanged(group);
      })
    );
    this._subscriptions.add(targetControl.valueChanges.subscribe(() => this.onProcessChanged(group)));

    // Re-check compatibility (debounced) whenever the mapping rows change, so incompatible pairs are
    // flagged as the user edits. Suggestion/restore apply rows with emitEvent:false and validate
    // explicitly, so this only fires for user edits.
    this._subscriptions.add(
      this.mapActivitiesArray(group)
        .valueChanges.pipe(debounceTime(300))
        .subscribe(() => this.validateInstruction(group))
    );

    return group;
  }

  private createMappingGroup(source = '', target = ''): FormGroup {
    return this.fb.group({
      source: this.fb.control(source),
      target: this.fb.control(target),
    });
  }

  private createVariableGroup(patch?: ProcessVariablePatch): FormGroup {
    const group = this.fb.group({
      mode: this.fb.control<PatchMode>(this.modeOf(patch)),
      source: this.fb.control(patch?.source ?? ''),
      value: this.fb.control(patch?.value != null ? String(patch.value) : ''),
      target: this.fb.control(patch?.target ?? ''),
      targetType: this.fb.control(patch?.targetType ?? ''),
    });

    // Clear the now-irrelevant input(s) when the mode switches, so the serialized patch stays clean.
    this._subscriptions.add(
      group.get('mode')!.valueChanges.subscribe(mode => {
        if (mode !== 'path') group.get('source')!.setValue('', {emitEvent: false});
        if (mode !== 'value') group.get('value')!.setValue('', {emitEvent: false});
      })
    );

    return group;
  }

  /**
   * Derive the edit mode from a stored patch: a source copy, a literal value, or null. A patch with
   * no source and no value (e.g. a target-only suggestion) clears the target, so it is 'null' — only
   * a brand-new, empty patch defaults to 'path'.
   */
  private modeOf(patch?: ProcessVariablePatch): PatchMode {
    if (!patch) return 'path';
    if (patch.source) return 'path';
    if (patch.value !== undefined && patch.value !== null) return 'value';
    return 'null';
  }

  /**
   * The user changed the source/target process: reload the activity options AND fetch a suggested
   * mapping, then apply BOTH in the same tick so each side's select has its (new) options ready when
   * its value is (re)applied — otherwise the target select, whose options changed, would render empty.
   */
  private onProcessChanged(group: FormGroup): void {
    const sourceId = this.definitionIdFor(group, 'source');
    const targetId = this.definitionIdFor(group, 'target');

    if (!sourceId || !targetId) {
      this._activities.set(group, {sourceNodes: [], targetNodes: [], loading: false});
      this.cdr.markForCheck();
      return;
    }

    this._activities.set(group, {sourceNodes: [], targetNodes: [], loading: true});
    this.cdr.markForCheck();

    const key = this.buildingBlockDefinitionKey;
    const tag = this.buildingBlockDefinitionVersionTag;
    // A failed suggestion (or missing params) leaves the mappings untouched: null = "don't touch".
    const mapping$ =
      key && tag
        ? this.buildingBlockMigrationApiService
            .suggestActivityMapping(
              {buildingBlockDefinitionKey: key, buildingBlockDefinitionVersionTag: tag},
              sourceId,
              targetId
            )
            .pipe(catchError(() => of<Record<string, string> | null>(null)))
        : of<Record<string, string> | null>(null);

    this._subscriptions.add(
      forkJoin({
        flowNodes: this.processService.getFlowNodes(sourceId, targetId).pipe(catchError(() => of(null))),
        mapping: mapping$,
      }).subscribe(({flowNodes, mapping}) => {
        this._activities.set(group, {
          sourceNodes: flowNodes ? this.toOptions(flowNodes.sourceFlowNodeMap) : [],
          targetNodes: flowNodes ? this.toOptions(flowNodes.targetFlowNodeMap) : [],
          loading: false,
        });

        if (mapping) {
          const mappings = this.mapActivitiesArray(group);
          mappings.clear({emitEvent: false});
          Object.entries(mapping).forEach(([source, target]) =>
            mappings.push(this.createMappingGroup(source, target), {emitEvent: false})
          );
          this.emit();
        }

        this.validateInstruction(group);
        this.cdr.markForCheck();
        // Options and rows are now set together, so a single re-sync reflects both selects.
        this.reapplySelections();
      })
    );
  }

  /** The version-correct process definition id for the group's source (or target) process key. */
  private definitionIdFor(group: FormGroup, side: 'source' | 'target'): string | undefined {
    const key = group.get(`${side}ProcessDefinitionKey`)?.value;
    const scoped = side === 'source' ? this.sourceProcessDefinitions : this.targetProcessDefinitions;
    return scoped?.[key] ?? this._keyToLatestId.get(key);
  }

  private loadActivities(group: FormGroup): void {
    const sourceId = this.definitionIdFor(group, 'source');
    const targetId = this.definitionIdFor(group, 'target');

    if (!sourceId || !targetId) {
      this._activities.set(group, {sourceNodes: [], targetNodes: [], loading: false});
      return;
    }

    this._activities.set(group, {sourceNodes: [], targetNodes: [], loading: true});
    this.cdr.markForCheck();

    this.processService.getFlowNodes(sourceId, targetId).subscribe({
      next: flowNodes => {
        // Each side's activities come straight from ITS process definition's flow nodes — no
        // augmenting with stored values and no auto-populating rows, so the dropdowns only ever offer
        // activities that actually belong to the selected process and only the configured mappings show.
        this._activities.set(group, {
          sourceNodes: this.toOptions(flowNodes.sourceFlowNodeMap),
          targetNodes: this.toOptions(flowNodes.targetFlowNodeMap),
          loading: false,
        });
        this.validateInstruction(group);
        this.cdr.markForCheck();
        // The activity <option>s only exist now, so re-sync the mapping selects with their values.
        this.reapplySelections();
      },
      error: () => {
        this._activities.set(group, {sourceNodes: [], targetNodes: [], loading: false});
        this.cdr.markForCheck();
      },
    });
  }

  /**
   * Carbon's `cds-select` only writes the native value in its setter/`ngAfterViewInit`, so a value
   * set before its `<option>`s exist is never reflected. Re-write each select value once the options
   * have been rendered (next macrotask) so restored plans show their selections. `emitEvent: false`
   * keeps this view-only sync from re-triggering the activity reload / change emission.
   */
  private reapplySelections(): void {
    setTimeout(() => {
      this.instructionsArray.controls.forEach(control => {
        const group = control as FormGroup;
        ['sourceProcessDefinitionKey', 'targetProcessDefinitionKey'].forEach(name =>
          group.get(name)?.setValue(group.get(name)?.value, {emitEvent: false})
        );
        this.mapActivitiesArray(group).controls.forEach(row =>
          ['source', 'target'].forEach(name =>
            row.get(name)?.setValue(row.get(name)?.value, {emitEvent: false})
          )
        );
      });
      this.cdr.markForCheck();
    });
  }

  /**
   * Ask the engine whether this instruction's activity mapping is a valid migration and remember the
   * incompatible pairs for the template. Needs the building block params and both process ids to
   * resolve the definitions; clears the flags when it cannot validate (e.g. no mapping yet).
   */
  private validateInstruction(group: FormGroup): void {
    const key = this.buildingBlockDefinitionKey;
    const tag = this.buildingBlockDefinitionVersionTag;
    const sourceId = this.definitionIdFor(group, 'source');
    const targetId = this.definitionIdFor(group, 'target');
    const mapping = this.mappingObject(group);

    if (!key || !tag || !sourceId || !targetId || Object.keys(mapping).length === 0) {
      this._invalidMappings.delete(group);
      this.cdr.markForCheck();
      return;
    }

    this.buildingBlockMigrationApiService
      .validateActivityMapping(
        {buildingBlockDefinitionKey: key, buildingBlockDefinitionVersionTag: tag},
        sourceId,
        targetId,
        mapping
      )
      .pipe(catchError(() => of<Record<string, string[]>>({})))
      .subscribe(invalid => {
        this._invalidMappings.set(group, invalid);
        this.cdr.markForCheck();
      });
  }

  /** The `sourceActivityId -> targetActivityId` map for an instruction, skipping incomplete rows. */
  private mappingObject(group: FormGroup): Record<string, string> {
    const mapping: Record<string, string> = {};
    this.mapActivitiesArray(group).controls.forEach(row => {
      const source = row.get('source')?.value;
      const target = row.get('target')?.value;
      if (source && target) mapping[source] = target;
    });
    return mapping;
  }

  private toOptions(flowNodeMap: {[activityId: string]: string}): FlowNodeOption[] {
    return Object.entries(flowNodeMap).map(([id, name]) => ({
      id,
      // Show name AND id so activities that share a title can be told apart.
      label: name && name !== id ? `${name} (${id})` : id,
    }));
  }

  private emit(): void {
    const instructions = this.serialize();
    this._lastEmitted = JSON.stringify(instructions);
    this.instructionsChange.emit(instructions);
  }

  private serialize(): ProcessMigrationInstruction[] {
    return this.instructionsArray.controls.map(control => {
      const group = control as FormGroup;

      const mapActivities: {[source: string]: string} = {};
      this.mapActivitiesArray(group).controls.forEach(row => {
        const source = row.get('source')?.value;
        const target = row.get('target')?.value;
        if (source && target) mapActivities[source] = target;
      });

      const setProcessVariables: ProcessVariablePatch[] = this.setProcessVariablesArray(group)
        .controls.map(row => {
          const {mode, source, value, target, targetType} = (row as FormGroup).getRawValue();
          const patch: ProcessVariablePatch = {target: target ?? ''};
          if (mode === 'null') patch.value = null;
          else if (mode === 'path') {
            if (source) patch.source = source;
          } else if (value !== '' && value != null) patch.value = value;
          if (mode !== 'null' && targetType) patch.targetType = targetType;
          return patch;
        })
        .filter(patch => !!patch.target);

      return {
        sourceProcessDefinitionKey: group.get('sourceProcessDefinitionKey')?.value ?? '',
        targetProcessDefinitionKey: group.get('targetProcessDefinitionKey')?.value ?? '',
        mapActivities,
        setProcessVariables,
        skipCustomListeners: !!group.get('skipCustomListeners')?.value,
        skipIoMappings: !!group.get('skipIoMappings')?.value,
      };
    });
  }

  private writeInstructions(instructions: ProcessMigrationInstruction[]): void {
    // Ignore the echo of our own emission to avoid rebuilding the form on every keystroke.
    if (JSON.stringify(instructions) === this._lastEmitted) return;

    this._activities.clear();
    this._invalidMappings.clear();
    this.instructionsArray.clear({emitEvent: false});
    instructions.forEach(instruction => {
      const group = this.createInstructionGroup(instruction);
      this.instructionsArray.push(group, {emitEvent: false});
      this.loadActivities(group);
    });
    this._lastEmitted = JSON.stringify(this.serialize());
  }
}
