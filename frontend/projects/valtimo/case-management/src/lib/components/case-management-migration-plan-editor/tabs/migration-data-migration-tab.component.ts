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
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {FormArray, FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {
  ButtonModule,
  IconModule,
  IconService,
  InputModule,
  SelectModule,
} from 'carbon-components-angular';
import {Add16, TrashCan16} from '@carbon/icons';
import {ValuePathSelectorComponent, ValuePathSelectorPrefix} from '@valtimo/components';
import {Subscription} from 'rxjs';
import {CASE_MANAGEMENT_MIGRATION_TEST_IDS} from '../../../constants';
import {DataMigrationPatch, DataMigrationTargetType, ValuePathContext} from '../../../models';

/** How the left ("from") side of a patch is filled: copy a field, set a literal, or set null. */
type PatchMode = 'path' | 'value' | 'null';

@Component({
  standalone: true,
  selector: 'valtimo-migration-data-migration-tab',
  templateUrl: './migration-data-migration-tab.component.html',
  styleUrls: ['./migration-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    InputModule,
    SelectModule,
    ValuePathSelectorComponent,
  ],
})
export class MigrationDataMigrationTabComponent implements OnInit, OnDestroy {
  // The document schemas the source (copy-from) and target (write-to) value-path selectors resolve
  // against. They can differ: e.g. add building block copies FROM the owner case INTO the block.
  @Input() public sourceContext: ValuePathContext | null = null;
  @Input() public targetContext: ValuePathContext | null = null;
  /** Intro text above the patches. Hosts that already explain the direction pass `null` to hide it. */
  @Input() public descriptionKey: string | null =
    'caseManagement.migration.editor.dataMigration.description';

  @Input() public set patches(value: DataMigrationPatch[] | null | undefined) {
    this.writePatches(value ?? []);
  }

  @Output() public readonly patchesChange = new EventEmitter<DataMigrationPatch[]>();

  protected readonly testIds = CASE_MANAGEMENT_MIGRATION_TEST_IDS;

  // Source can copy from document data or case metadata; the target must be a writable document path.
  public readonly SOURCE_PREFIXES = [ValuePathSelectorPrefix.DOC, ValuePathSelectorPrefix.CASE];
  public readonly TARGET_PREFIXES = [ValuePathSelectorPrefix.DOC];

  public readonly MODES: PatchMode[] = ['path', 'value', 'null'];

  public readonly TARGET_TYPES: DataMigrationTargetType[] = [
    'string',
    'integer',
    'long',
    'number',
    'double',
    'boolean',
  ];

  public readonly form = this.fb.group({
    patches: this.fb.array<FormGroup>([]),
  });

  private _lastEmitted = '[]';
  private readonly _subscriptions = new Subscription();

  public get patchesArray(): FormArray {
    return this.form.get('patches') as FormArray;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Add16, TrashCan16]);
  }

  public ngOnInit(): void {
    this._subscriptions.add(this.form.valueChanges.subscribe(() => this.emit()));
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public addPatch(): void {
    this.patchesArray.push(this.createPatchGroup());
  }

  public removePatch(index: number): void {
    this.patchesArray.removeAt(index);
  }

  private createPatchGroup(patch?: DataMigrationPatch): FormGroup {
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
   * no source and no value (e.g. a target-only suggestion `{target: 'doc:/x'}`) clears the target, so
   * it is 'null' — only a brand-new, empty patch defaults to 'path'.
   */
  private modeOf(patch?: DataMigrationPatch): PatchMode {
    if (!patch) return 'path';
    if (patch.source) return 'path';
    if (patch.value !== undefined && patch.value !== null) return 'value';
    return 'null';
  }

  private emit(): void {
    const patches = this.serialize();
    this._lastEmitted = JSON.stringify(patches);
    this.patchesChange.emit(patches);
  }

  private serialize(): DataMigrationPatch[] {
    return this.patchesArray.controls.map(control => {
      const {mode, source, value, target, targetType} = (control as FormGroup).getRawValue();
      const patch: DataMigrationPatch = {target: target ?? ''};

      if (mode === 'null') {
        patch.value = null;
      } else if (mode === 'path') {
        if (source) patch.source = source;
      } else if (value !== '' && value != null) {
        patch.value = value;
      }

      // targetType coerces a copied/set value; it is meaningless when clearing to null.
      if (mode !== 'null' && targetType) patch.targetType = targetType;

      return patch;
    });
  }

  private writePatches(patches: DataMigrationPatch[]): void {
    // Ignore the echo of our own emission to avoid rebuilding the form (and losing focus) on every keystroke.
    if (JSON.stringify(patches) === this._lastEmitted) return;

    this.patchesArray.clear({emitEvent: false});
    patches.forEach(patch =>
      this.patchesArray.push(this.createPatchGroup(patch), {emitEvent: false})
    );
    this._lastEmitted = JSON.stringify(this.serialize());
  }
}
