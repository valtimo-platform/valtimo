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
import {Information16, TrashCan16} from '@carbon/icons';
import {SelectItem} from '@valtimo/components';
import {IconService} from 'carbon-components-angular';
import {BehaviorSubject, Subscription} from 'rxjs';
import {ACCESS_CONTROL_EDITOR_TEST_IDS, NO_CONTEXT_RESOURCE_TYPE} from '../../constants';
import {AccessControlFormEditorService} from '../../services';
import {shortTypeName} from '../../utils';

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
  @Input() public roleKey: string | null = null;

  @Output() public removeEvent = new EventEmitter<void>();

  public resourceTypeItems: SelectItem[] = [];
  public actionItems: SelectItem[] = [];
  public contextResourceTypeItems: SelectItem[] = [];
  // Whether the resource type has any related resources to scope to — gates the "Specific context"
  // option in the context switcher.
  public hasContextTargets = false;

  // The form is rendered (but visually hidden) from the start so the wrapped comboboxes can
  // initialize and fill in their preselected values. A spinner is shown until that has happened,
  // after which the prefilled form is revealed.
  public readonly $loading = signal<boolean>(true);

  // The permission is shown as a three-section accordion. Only one section is open at a time;
  // "Resource & actions" is open by default.
  public readonly $openSection = signal<'resourceActions' | 'conditions' | 'context' | null>(
    'resourceActions'
  );

  // Controls the "remove permission" confirmation modal. Removal only happens on confirm, and even
  // then it just drops the permission from the editable list — nothing is persisted until the whole
  // set of permissions is saved.
  public readonly showRemoveModal$ = new BehaviorSubject<boolean>(false);

  protected readonly testIds = ACCESS_CONTROL_EDITOR_TEST_IDS;

  private readonly _subscriptions = new Subscription();
  private _revealTimeoutId?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly formEditorService: AccessControlFormEditorService,
    private readonly iconService: IconService,
    private readonly changeDetectorRef: ChangeDetectorRef
  ) {
    this.iconService.registerAll([Information16, TrashCan16]);
  }

  public get resourceTypeValue(): string {
    return this.group.get('resourceType')!.value;
  }

  // The short (simple) class name of the resource type, e.g. "CaseDefinition" for
  // "com.ritense.case_.domain.definition.CaseDefinition". Shown as the preview title, with the full
  // technical name as a subtitle beneath it.
  public get resourceShortName(): string {
    return shortTypeName(this.resourceTypeValue);
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

  // The three-way context choice, derived from the form: 'none' (context is ignored), 'noContext'
  // (only applies when there is no context) or 'specific' (restricted to a context resource).
  public get contextMode(): 'none' | 'noContext' | 'specific' {
    if (!this.hasContext) return 'none';
    return this.hasContextResource ? 'specific' : 'noContext';
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
    this.showRemoveModal$.complete();
    if (this._revealTimeoutId !== undefined) clearTimeout(this._revealTimeoutId);
  }

  // Applies a context-switcher choice to the form. 'none' clears context entirely; 'noContext'
  // scopes the permission to the "no context" marker; 'specific' scopes it to a real context
  // resource (keeping the current one, or defaulting to the first available target).
  public onContextModeChange(mode: 'none' | 'noContext' | 'specific'): void {
    if (this.disabled || mode === this.contextMode) return;

    const hasContext = this.group.get('hasContext')!;
    const contextResourceType = this.group.get('contextResourceType')!;

    if (mode === 'none') {
      hasContext.setValue(false);
      return;
    }

    hasContext.setValue(true);
    if (mode === 'noContext') {
      contextResourceType.setValue(NO_CONTEXT_RESOURCE_TYPE);
    } else if (!this.hasContextResource) {
      const firstTarget = this.formEditorService.containerTargetItems(this.resourceTypeValue)[0]
        ?.id;
      contextResourceType.setValue(firstTarget ?? NO_CONTEXT_RESOURCE_TYPE);
    }
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

  public openRemoveModal(): void {
    this.showRemoveModal$.next(true);
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

  // The context choices depend on the selected resource type, so recompute on change. The "specific
  // context" dropdown lists only real target resources ("no context" is its own switcher mode); if
  // the selected resource is no longer a valid target, fall back to the "no context" marker.
  private recomputeContextResourceTypeItems(): void {
    const validTargets = this.formEditorService.containerTargetItems(this.resourceTypeValue);
    this.hasContextTargets = validTargets.length > 0;

    const current = this.contextResourceTypeValue;
    if (
      current &&
      current !== NO_CONTEXT_RESOURCE_TYPE &&
      !validTargets.some(target => target.id === current)
    ) {
      this.group.get('contextResourceType')!.setValue(NO_CONTEXT_RESOURCE_TYPE);
    }

    this.contextResourceTypeItems = this.formEditorService.containerTargetItems(
      this.resourceTypeValue,
      this.hasContextResource ? this.contextResourceTypeValue : null
    );
  }
}
