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
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import {FormArray, FormControl, FormGroup} from '@angular/forms';
import {TrashCan16} from '@carbon/icons';
import {SelectItem} from '@valtimo/components';
import {IconService} from 'carbon-components-angular';
import {Subscription} from 'rxjs';
import {ACCESS_CONTROL_EDITOR_TEST_IDS, NO_CONTEXT_RESOURCE_TYPE} from '../../constants';
import {AccessControlFormEditorService} from '../../services';

@Component({
  standalone: false,
  selector: 'valtimo-permission-form',
  templateUrl: './permission-form.component.html',
  styleUrls: ['./permission-form.component.scss'],
})
export class PermissionFormComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() public group!: FormGroup;
  @Input() public index = 0;
  @Input() public disabled = false;

  @Output() public removeEvent = new EventEmitter<void>();

  public resourceTypeItems: SelectItem[] = [];
  public actionItems: SelectItem[] = [];
  public contextResourceTypeItems: SelectItem[] = [];

  // The form is rendered (but visually hidden) from the start so the wrapped comboboxes can
  // initialize and fill in their preselected values. A spinner is shown until that has happened,
  // after which the prefilled form is revealed.
  public readonly $loading = signal<boolean>(true);

  // The permission is shown as a three-section accordion. Only one section is open at a time;
  // "Resource & actions" is open by default.
  public readonly $openSection = signal<'resourceActions' | 'conditions' | 'context' | null>(
    'resourceActions'
  );

  protected readonly testIds = ACCESS_CONTROL_EDITOR_TEST_IDS;

  private readonly _subscriptions = new Subscription();
  private _revealTimeoutId?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly formEditorService: AccessControlFormEditorService,
    private readonly iconService: IconService,
    private readonly changeDetectorRef: ChangeDetectorRef
  ) {
    this.iconService.registerAll([TrashCan16]);
  }

  public get resourceTypeValue(): string {
    return this.group.get('resourceType')!.value;
  }

  public get contextResourceTypeValue(): string | null {
    return this.group.get('contextResourceType')!.value;
  }

  // Whether context scoping is enabled (the toggle). Off means no context is written at all.
  public get hasContext(): boolean {
    return this.group.get('hasContext')!.value;
  }

  // True when a real context resource is selected (i.e. anything other than the "No context"
  // marker). Gates the context condition tree — the marker has no fields to build conditions on.
  public get hasContextResource(): boolean {
    const value = this.contextResourceTypeValue;
    return !!value && value !== NO_CONTEXT_RESOURCE_TYPE;
  }

  public get actionsControl(): FormControl {
    return this.group.get('actions') as FormControl;
  }

  public get selectedActions(): string[] {
    return this.actionsControl.value ?? [];
  }

  public get conditionsArray(): FormArray {
    return this.group.get('conditions') as FormArray;
  }

  public get contextConditionsArray(): FormArray {
    return this.group.get('contextConditions') as FormArray;
  }

  public ngOnInit(): void {
    this.resourceTypeItems = this.formEditorService.resourceTypeItems(this.resourceTypeValue);
    this.recomputeActionItems();
    this.recomputeContextResourceTypeItems();

    this._subscriptions.add(
      this.group.get('resourceType')!.valueChanges.subscribe(() => {
        this.recomputeActionItems();
        this.recomputeContextResourceTypeItems();
      })
    );
  }

  public ngAfterViewInit(): void {
    // The child comboboxes flush their preselected values in a setTimeout scheduled during their
    // own view initialization (child hooks run first). This setTimeout therefore runs after them,
    // at which point the form is prefilled and can be revealed.
    this._revealTimeoutId = setTimeout(() => {
      this.$loading.set(false);
      this.changeDetectorRef.detectChanges();
    });
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    if (this._revealTimeoutId !== undefined) clearTimeout(this._revealTimeoutId);
  }

  public onToggleContext(checked: boolean): void {
    // No validators depend on this, so the form validity can never get stuck; setValue emits so the
    // parent re-serializes (dropping or adding the context fields).
    this.group.get('hasContext')!.setValue(checked);
  }

  public onActionToggle(action: string, checked: boolean): void {
    const actions = new Set(this.selectedActions);
    if (checked) {
      actions.add(action);
    } else {
      actions.delete(action);
    }
    this.actionsControl.setValue([...actions]);
    this.actionsControl.markAsTouched();
  }

  public onSectionToggle(
    section: 'resourceActions' | 'conditions' | 'context',
    event: {expanded?: boolean}
  ): void {
    // Only one section is open at a time: opening one collapses the others via the [expanded]
    // bindings; collapsing the open one leaves all sections closed.
    this.$openSection.set(event?.expanded ? section : null);
  }

  public onRemove(): void {
    this.removeEvent.emit();
  }

  private recomputeActionItems(): void {
    this.actionItems = this.formEditorService.actionItems(
      this.resourceTypeValue,
      this.actionsControl.value ?? []
    );
  }

  // The valid context resources depend on the selected resource type, so recompute whenever it
  // changes. "No context" is always available; if the previously-selected context resource is no
  // longer a valid target for the (changed) resource type, fall back to "No context".
  private recomputeContextResourceTypeItems(): void {
    const validTargets = this.formEditorService.containerTargetItems(this.resourceTypeValue);
    const current = this.contextResourceTypeValue;
    if (
      current &&
      current !== NO_CONTEXT_RESOURCE_TYPE &&
      !validTargets.some(target => target.id === current)
    ) {
      this.group.get('contextResourceType')!.setValue(NO_CONTEXT_RESOURCE_TYPE);
    }

    this.contextResourceTypeItems = this.formEditorService.contextResourceTypeItems(
      this.resourceTypeValue,
      this.contextResourceTypeValue
    );
  }
}
