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
import {ACCESS_CONTROL_EDITOR_TEST_IDS} from '../../constants';
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

  public get hasContext(): boolean {
    return this.group.get('hasContext')!.value;
  }

  public get actionsControl(): FormControl {
    return this.group.get('actions') as FormControl;
  }

  public get selectedActions(): string[] {
    return this.actionsControl.value ?? [];
  }

  public get contextResourceTypeRequired(): boolean {
    return !!this.group.errors?.['contextResourceTypeRequired'];
  }

  public get conditionsArray(): FormArray {
    return this.group.get('conditions') as FormArray;
  }

  public get contextConditionsArray(): FormArray {
    return this.group.get('contextConditions') as FormArray;
  }

  public ngOnInit(): void {
    this.resourceTypeItems = this.formEditorService.resourceTypeItems(this.resourceTypeValue);
    this.contextResourceTypeItems = this.formEditorService.contextResourceTypeItems(
      this.contextResourceTypeValue
    );
    this.recomputeActionItems();

    this._subscriptions.add(
      this.group.get('resourceType')!.valueChanges.subscribe(() => this.recomputeActionItems())
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
    this.group.get('hasContext')!.setValue(checked);
    this.group.updateValueAndValidity();
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
}
