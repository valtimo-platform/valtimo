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
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {FormArray, FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';
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
import {Subscription} from 'rxjs';
import {CASE_MANAGEMENT_MIGRATION_TEST_IDS} from '../../../constants';
import {ProcessMigrationInstruction} from '../../../models';

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
  selector: 'valtimo-migration-process-migration-tab',
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
  ],
})
export class MigrationProcessMigrationTabComponent implements OnInit, OnDestroy {
  @Input() public set instructions(value: ProcessMigrationInstruction[] | null | undefined) {
    this.writeInstructions(value ?? []);
  }

  @Output() public readonly instructionsChange = new EventEmitter<ProcessMigrationInstruction[]>();

  protected readonly testIds = CASE_MANAGEMENT_MIGRATION_TEST_IDS;

  /** Sentinel target used to explicitly drop an activity token during migration. */
  public readonly SKIP_MIGRATION = '<SKIP_MIGRATION>';

  public processDefinitionKeys: string[] = [];

  public readonly form = this.fb.group({
    instructions: this.fb.array<FormGroup>([]),
  });

  private readonly _keyToLatestId = new Map<string, string>();
  private readonly _activities = new Map<FormGroup, InstructionActivities>();
  private _lastEmitted = '[]';
  private readonly _subscriptions = new Subscription();

  public get instructionsArray(): FormArray {
    return this.form.get('instructions') as FormArray;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly cdr: ChangeDetectorRef,
    private readonly iconService: IconService,
    private readonly processService: ProcessService
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
      this.instructionsArray.controls.forEach(control =>
        this.loadActivities(control as FormGroup)
      );
      this.cdr.markForCheck();
      // The process-definition <option>s only exist now, so re-sync the selects with their values.
      this.reapplySelections();
    });

    this._subscriptions.add(this.form.valueChanges.subscribe(() => this.emit()));
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public activitiesFor(group: FormGroup): InstructionActivities {
    return this._activities.get(group) ?? {sourceNodes: [], targetNodes: [], loading: false};
  }

  public mapActivitiesArray(group: FormGroup): FormArray {
    return group.get('mapActivities') as FormArray;
  }

  public newProcessVariablesArray(group: FormGroup): FormArray {
    return group.get('newProcessVariables') as FormArray;
  }

  public addInstruction(): void {
    this.instructionsArray.push(this.createInstructionGroup());
  }

  public removeInstruction(index: number): void {
    const group = this.instructionsArray.at(index) as FormGroup;
    this._activities.delete(group);
    this.instructionsArray.removeAt(index);
  }

  public addMapping(group: FormGroup): void {
    this.mapActivitiesArray(group).push(this.createMappingGroup());
  }

  public removeMapping(group: FormGroup, index: number): void {
    this.mapActivitiesArray(group).removeAt(index);
  }

  public addVariable(group: FormGroup): void {
    this.newProcessVariablesArray(group).push(this.createVariableGroup());
  }

  public removeVariable(group: FormGroup, index: number): void {
    this.newProcessVariablesArray(group).removeAt(index);
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
      newProcessVariables: this.fb.array<FormGroup>(
        Object.entries(instruction?.newProcessVariables ?? {}).map(([name, value]) =>
          this.createVariableGroup(name, value)
        )
      ),
      skipCustomListeners: this.fb.control(instruction?.skipCustomListeners ?? false),
      skipIoMappings: this.fb.control(instruction?.skipIoMappings ?? false),
    });

    // Reload the selectable activities whenever the user picks a different source/target definition.
    this._subscriptions.add(
      group.get('sourceProcessDefinitionKey')!.valueChanges.subscribe(() => this.loadActivities(group))
    );
    this._subscriptions.add(
      group.get('targetProcessDefinitionKey')!.valueChanges.subscribe(() => this.loadActivities(group))
    );

    return group;
  }

  private createMappingGroup(source = '', target = ''): FormGroup {
    return this.fb.group({
      source: this.fb.control(source),
      target: this.fb.control(target),
    });
  }

  private createVariableGroup(name = '', value: unknown = ''): FormGroup {
    return this.fb.group({
      name: this.fb.control(name),
      value: this.fb.control(value != null ? String(value) : ''),
    });
  }

  private loadActivities(group: FormGroup): void {
    const sourceKey = group.get('sourceProcessDefinitionKey')?.value;
    const targetKey = group.get('targetProcessDefinitionKey')?.value;
    const sourceId = this._keyToLatestId.get(sourceKey);
    const targetId = this._keyToLatestId.get(targetKey);

    if (!sourceId || !targetId) {
      this._activities.set(group, {sourceNodes: [], targetNodes: [], loading: false});
      return;
    }

    this._activities.set(group, {sourceNodes: [], targetNodes: [], loading: true});
    this.cdr.markForCheck();

    this.processService.getFlowNodes(sourceId, targetId).subscribe({
      next: flowNodes => {
        const sourceNodes = this.toOptions(flowNodes.sourceFlowNodeMap);
        const targetNodes = this.toOptions(flowNodes.targetFlowNodeMap);
        this._activities.set(group, {sourceNodes, targetNodes, loading: false});
        this.ensureMappingRows(group, sourceNodes);
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

  private ensureMappingRows(group: FormGroup, sourceNodes: FlowNodeOption[]): void {
    const mappings = this.mapActivitiesArray(group);
    const existing = new Set(mappings.controls.map(control => control.get('source')?.value));
    // Pre-populate a row for every source activity that is not mapped yet.
    sourceNodes
      .filter(node => !existing.has(node.id))
      .forEach(node => mappings.push(this.createMappingGroup(node.id), {emitEvent: false}));
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

      const newProcessVariables: {[name: string]: unknown} = {};
      this.newProcessVariablesArray(group).controls.forEach(row => {
        const name = row.get('name')?.value;
        if (name) newProcessVariables[name] = row.get('value')?.value ?? '';
      });

      return {
        sourceProcessDefinitionKey: group.get('sourceProcessDefinitionKey')?.value ?? '',
        targetProcessDefinitionKey: group.get('targetProcessDefinitionKey')?.value ?? '',
        mapActivities,
        newProcessVariables,
        skipCustomListeners: !!group.get('skipCustomListeners')?.value,
        skipIoMappings: !!group.get('skipIoMappings')?.value,
      };
    });
  }

  private writeInstructions(instructions: ProcessMigrationInstruction[]): void {
    // Ignore the echo of our own emission to avoid rebuilding the form on every keystroke.
    if (JSON.stringify(instructions) === this._lastEmitted) return;

    this._activities.clear();
    this.instructionsArray.clear({emitEvent: false});
    instructions.forEach(instruction => {
      const group = this.createInstructionGroup(instruction);
      this.instructionsArray.push(group, {emitEvent: false});
      this.loadActivities(group);
    });
    this._lastEmitted = JSON.stringify(this.serialize());
  }
}
