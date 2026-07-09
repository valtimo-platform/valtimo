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

import {Component, Input, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import {AbstractControl, FormArray, FormGroup} from '@angular/forms';
import {Add16, TrashCan16} from '@carbon/icons';
import {SelectItem} from '@valtimo/components';
import {IconService} from 'carbon-components-angular';
import {ACCESS_CONTROL_EDITOR_TEST_IDS} from '../../constants';
import {ConditionType} from '../../models';
import {AccessControlFormEditorService} from '../../services';

@Component({
  standalone: false,
  selector: 'valtimo-condition-tree',
  templateUrl: './condition-tree.component.html',
  styleUrls: ['./condition-tree.component.scss'],
})
export class ConditionTreeComponent implements OnInit, OnChanges {
  @Input() public conditions!: FormArray;
  @Input() public resourceType: string | null = null;
  @Input() public disabled = false;
  @Input() public depth = 0;

  public fieldItems: SelectItem[] = [];
  public containerTargetItems: SelectItem[] = [];
  public operatorItems: SelectItem[] = [];
  // Preset value types for JSON-field conditions (String, Boolean, …). The dropdown only ever holds
  // presets — custom types are entered via manual mode — so this list is stable.
  public valueTypeItems: SelectItem[] = [];

  // Condition types are shown in natural language. "Related resource" (container) is only offered
  // when the resource can be related to another resource (see recomputeItems).
  public typeItems: SelectItem[] = [];

  protected readonly testIds = ACCESS_CONTROL_EDITOR_TEST_IDS;

  // Carbon only provides three layer tokens, and they alternate (layer 0 and 2 share a surface
  // colour, layer 1 is the contrasting one). To keep every nesting level visually distinct from
  // the one it sits on, the condition rows alternate between layer 1 and 2 as they nest. The
  // permission card sits on layer 0, so the first row level is layer 1.
  public get rowLayerLevel(): 1 | 2 {
    return this.depth % 2 === 0 ? 1 : 2;
  }

  // Inputs use the layer that contrasts with their row's surface, so the field background always
  // stands out from the row it sits on (layer 1 ↔ layer 2).
  public get inputLayerLevel(): 1 | 2 {
    return this.rowLayerLevel === 1 ? 2 : 1;
  }

  constructor(
    private readonly formEditorService: AccessControlFormEditorService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Add16, TrashCan16]);
  }

  public ngOnInit(): void {
    this.operatorItems = this.formEditorService.operatorItems();
    this.valueTypeItems = this.formEditorService.valueTypeItems();
    this.recomputeItems();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['resourceType']) this.recomputeItems();
  }

  public groupAt(index: number): FormGroup {
    return this.conditions.at(index) as FormGroup;
  }

  public asFormGroup(control: AbstractControl): FormGroup {
    return control as FormGroup;
  }

  public typeOf(index: number): ConditionType {
    return this.groupAt(index).get('type')!.value;
  }

  public nestedConditions(index: number): FormArray {
    return this.groupAt(index).get('conditions') as FormArray;
  }

  public containerResourceType(index: number): string | null {
    return this.groupAt(index).get('resourceType')!.value || null;
  }

  public containerResourceTypeAt(index: number): string {
    return this.groupAt(index).get('resourceType')!.value || '';
  }

  public fieldValueAt(index: number): string {
    return this.groupAt(index).get('field')!.value || '';
  }

  public operatorValueAt(index: number): string {
    return this.groupAt(index).get('operator')!.value || '';
  }

  public clazzValueAt(index: number): string {
    return this.groupAt(index).get('clazz')!.value || '';
  }

  // Whether the value type is entered manually (a custom class) rather than picked from the preset
  // dropdown.
  public clazzManualAt(index: number): boolean {
    return !!this.groupAt(index).get('clazzManual')!.value;
  }

  public addCondition(): void {
    this.conditions.push(this.formEditorService.createConditionGroup(undefined, 'field'));
  }

  public removeCondition(index: number): void {
    this.conditions.removeAt(index);
  }

  // Toggles the value-type input between the preset dropdown and manual entry. Switching back to the
  // dropdown with nothing entered yet falls back to the default type.
  public onClazzManualToggle(index: number, manual: boolean): void {
    const group = this.groupAt(index);
    group.get('clazzManual')!.setValue(manual);
    // The dropdown only lists presets, so entering it with an empty or custom value falls back to
    // the default preset rather than leaving the dropdown with nothing selected.
    const clazz = group.get('clazz')!.value;
    if (!manual && (!clazz || this.formEditorService.isCustomValueType(clazz))) {
      group.get('clazz')!.setValue(this.formEditorService.defaultValueType);
    }
  }

  public onTypeChange(index: number): void {
    const group = this.groupAt(index);
    // Switching to a JSON field (expression) defaults the value type to a preset so its dropdown
    // starts on a valid, selected option.
    if (group.get('type')!.value === 'expression' && !group.get('clazz')!.value) {
      group.get('clazz')!.setValue(this.formEditorService.defaultValueType);
      group.get('clazzManual')!.setValue(false);
    }
    this.recomputeItems();
  }

  private recomputeItems(): void {
    const resourceType = this.resourceType ?? '';
    this.fieldItems = this.formEditorService.fieldItems(resourceType, this.collectFieldValues());
    this.containerTargetItems = this.formEditorService.containerTargetItems(
      resourceType,
      this.collectContainerTargets()
    );
    // Only offer the "related resource" (container) type when the resource actually has related
    // resources to point at; otherwise a container condition could never be completed.
    const types: ConditionType[] = this.containerTargetItems.length
      ? ['field', 'expression', 'container']
      : ['field', 'expression'];
    this.typeItems = types.map(type => ({
      id: type,
      translationKey: `accessControl.editor.conditionTypes.${type}`,
    }));
  }

  private collectFieldValues(): string[] {
    return this.conditions.controls
      .map(control => (control as FormGroup).get('field')!.value)
      .filter((value: string) => !!value);
  }

  private collectContainerTargets(): string[] {
    return this.conditions.controls
      .map(control => (control as FormGroup).get('resourceType')!.value)
      .filter((value: string) => !!value);
  }
}
