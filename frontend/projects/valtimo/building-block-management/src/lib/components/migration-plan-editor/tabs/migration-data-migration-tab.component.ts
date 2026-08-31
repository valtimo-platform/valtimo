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
import {
  DataMigrationPatch,
  DataMigrationTargetType,
  MigrationEditorTestIds,
  ValuePathContext,
} from '../../../models';

/** How the left ("from") side of a patch is filled: copy a field, set a literal, or set null. */
type PatchMode = 'path' | 'value' | 'null';

/**
 * The `dataMigration` component of a migration plan, for either blueprint type.
 *
 * Nothing here is case- or building-block-specific: a patch names a source path, a target path and a
 * coercion, and *which document* either path resolves against is [sourceContext] / [targetContext]'s
 * business — set by whoever hosts this. That is also why the same component serves the plan-level
 * `dataMigration` and the one nested inside every `addBuildingBlock` / `removeBuildingBlock` entry,
 * where the two contexts deliberately differ.
 */
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
  // against. They can differ: e.g. add building block copies FROM the owner INTO the block.
  @Input() public sourceContext: ValuePathContext | null = null;
  @Input() public targetContext: ValuePathContext | null = null;
  /**
   * Extra version tags (of the target's definition) merged into the target ("to") field list, on top
   * of the target version. Set to the source (predecessor) version so a patch can null out a field
   * that only exists in the source version and would otherwise be an unclearable leftover.
   */
  @Input() public targetAdditionalVersionTags: string[] = [];
  /** Intro text above the patches. Hosts that already explain the direction pass `null` to hide it. */
  @Input() public descriptionKey: string | null = null;
  /**
   * What the source ("from") picker may read. A case plan adds `case:` metadata to the document paths
   * a building block plan is limited to, which is the whole of the difference between the two hosts.
   */
  @Input() public sourcePrefixes: ValuePathSelectorPrefix[] = [ValuePathSelectorPrefix.DOC];
  @Input() public testIds!: MigrationEditorTestIds;

  @Input() public set patches(value: DataMigrationPatch[] | null | undefined) {
    this.writePatches(value ?? []);
  }

  @Output() public readonly patchesChange = new EventEmitter<DataMigrationPatch[]>();

  // The target must always be a writable document path, whichever blueprint owns it.
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
   * Derive the edit mode from a stored patch: a source copy, a literal value, or null.
   *
   * An explicit `value: null` is a clearing patch — the target version does not have this field — and
   * a patch with **neither** a source nor a `value` key is a copy whose source is not filled in yet,
   * which is what the suggester returns for a field it could not pair. The engine applies both as a
   * null write, so they were the same three bytes on the wire and read as the same finished row; they
   * are now told apart, and the unfinished one opens on the source selector it is waiting for.
   */
  private modeOf(patch?: DataMigrationPatch): PatchMode {
    if (!patch) return 'path';
    if (patch.source) return 'path';
    if (patch.value === null) return 'null';
    if (patch.value !== undefined) return 'value';
    return 'path';
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
