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
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  signal,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {AbstractControl, FormArray, FormGroup} from '@angular/forms';
import {Add16} from '@carbon/icons';
import {EditorModel} from '@valtimo/components';
import {IconService} from 'carbon-components-angular';
import {combineLatest, Subscription, take} from 'rxjs';
import {ACCESS_CONTROL_EDITOR_TEST_IDS} from '../../constants';
import {Permission} from '../../models';
import {AccessControlFormEditorService, PermissionSchemaMetadataService} from '../../services';

@Component({
  standalone: false,
  selector: 'valtimo-access-control-form-editor-tab',
  templateUrl: './access-control-form-editor-tab.component.html',
  styleUrls: ['./access-control-form-editor-tab.component.scss'],
  providers: [AccessControlFormEditorService],
})
export class AccessControlFormEditorTabComponent implements OnChanges, OnDestroy {
  @ViewChild('permissionList') private _permissionList?: ElementRef<HTMLElement>;

  @Input() public model: EditorModel | null = null;
  @Input() public disabled: boolean | null = false;

  @Output() public validEvent = new EventEmitter<boolean>();
  @Output() public valueChangeEvent = new EventEmitter<string>();

  public permissionsArray: FormArray | null = null;
  public ready = false;

  // Index of the permission shown in the detail panel. Null when there are no permissions.
  public readonly $selectedIndex = signal<number | null>(null);

  protected readonly testIds = ACCESS_CONTROL_EDITOR_TEST_IDS;

  private _valueChangesSubscription?: Subscription;

  constructor(
    private readonly formEditorService: AccessControlFormEditorService,
    private readonly metadataService: PermissionSchemaMetadataService,
    private readonly iconService: IconService,
    private readonly changeDetectorRef: ChangeDetectorRef
  ) {
    this.iconService.registerAll([Add16]);
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['model']) {
      this.rebuild();
    } else if (changes['disabled']) {
      this.applyDisabled();
    }
  }

  public ngOnDestroy(): void {
    this._valueChangesSubscription?.unsubscribe();
  }

  // ----- Sidebar item display -----

  // The sidebar shows the resource's short (simple) name, e.g. "CaseTab" for
  // "com.ritense.case.domain.CaseTab". The full technical name is still what is edited and stored.
  public shortName(control: AbstractControl): string {
    const resourceType = (control as FormGroup).get('resourceType')!.value as string;
    if (!resourceType) return '';
    return resourceType.substring(resourceType.lastIndexOf('.') + 1);
  }

  public actionsOf(control: AbstractControl): string[] {
    return ((control as FormGroup).get('actions')!.value as string[]) ?? [];
  }

  // ----- Selection -----

  public selectPermission(index: number): void {
    this.$selectedIndex.set(index);
  }

  // Returns the selected permission as a single-element array so the template can render it with a
  // keyed @for: tracking by the FormGroup reference recreates the detail form (and re-runs its
  // combobox prefill) whenever the selection changes.
  public selectedControls(): AbstractControl[] {
    const index = this.$selectedIndex();
    if (index === null || !this.permissionsArray || index >= this.permissionsArray.length) {
      return [];
    }
    return [this.permissionsArray.at(index)];
  }

  public addPermission(): void {
    if (!this.permissionsArray) return;

    const group = this.formEditorService.createPermissionGroup();
    this.permissionsArray.push(group);
    this.$selectedIndex.set(this.permissionsArray.length - 1);
    this.changeDetectorRef.markForCheck();
    this.scrollNewPermissionIntoView();
  }

  // The new permission is appended at the bottom of the sidebar list; once it has rendered, scroll
  // the list so the freshly-added (and now selected) item is brought into view.
  private scrollNewPermissionIntoView(): void {
    setTimeout(() => {
      const list = this._permissionList?.nativeElement;
      if (list) list.scrollTo({top: list.scrollHeight, behavior: 'smooth'});
    });
  }

  public removePermission(index: number): void {
    if (!this.permissionsArray) return;

    this.permissionsArray.removeAt(index);
    const remaining = this.permissionsArray.length;
    // Keep a valid selection: stay on the same slot, or fall back to the new last one.
    this.$selectedIndex.set(remaining === 0 ? null : Math.min(index, remaining - 1));
    this.changeDetectorRef.markForCheck();
  }

  private rebuild(): void {
    combineLatest([this.metadataService.registry$, this.metadataService.actionsByResourceType$])
      .pipe(take(1))
      .subscribe(([registry, actionsByResourceType]) => {
        this.formEditorService.setRegistry(registry);
        this.formEditorService.setActionsByResourceType(actionsByResourceType);
        this.buildForm();
      });
  }

  private buildForm(): void {
    this.permissionsArray = this.formEditorService.buildPermissionsArray(this.parsePermissions());
    this.$selectedIndex.set(this.permissionsArray.length ? 0 : null);
    this.applyDisabled();

    this._valueChangesSubscription?.unsubscribe();
    this._valueChangesSubscription = this.permissionsArray.valueChanges.subscribe(() =>
      this.emitState()
    );

    this.ready = true;
    this.emitState();
    this.changeDetectorRef.markForCheck();
  }

  private applyDisabled(): void {
    if (!this.permissionsArray) return;

    if (this.disabled && this.permissionsArray.enabled) {
      this.permissionsArray.disable({emitEvent: false});
    } else if (!this.disabled && this.permissionsArray.disabled) {
      this.permissionsArray.enable({emitEvent: false});
    }
  }

  private emitState(): void {
    if (!this.permissionsArray) return;

    this.valueChangeEvent.emit(
      JSON.stringify(this.formEditorService.serialize(this.permissionsArray))
    );
    this.validEvent.emit(this.permissionsArray.valid);
  }

  private parsePermissions(): Permission[] {
    if (!this.model?.value) return [];
    try {
      const parsed = JSON.parse(this.model.value);
      return Array.isArray(parsed) ? (parsed as Permission[]) : [];
    } catch {
      return [];
    }
  }
}
