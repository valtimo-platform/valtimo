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
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
} from '@angular/forms';
import {Subscription} from 'rxjs';
import {isEqual} from 'lodash';
import {
  ButtonModule,
  IconModule,
  InputModule,
  LayerModule,
} from 'carbon-components-angular';
import {TranslateModule} from '@ngx-translate/core';
import {
  InputLabelModule,
  SelectItem,
  SelectModule,
  ValuePathSelectorComponent,
  ValuePathSelectorPrefix,
} from '@valtimo/components';
import {PluginActionResultMapping} from '../../models';
import {ResultMappingRowFormGroup, ResultMappingsFormGroup} from '../../models';
import {PLUGIN_ACTION_RESULT_MAPPINGS_TEST_IDS} from '../../constants';

@Component({
  standalone: true,
  selector: 'valtimo-plugin-action-result-mappings',
  templateUrl: './plugin-action-result-mappings.component.html',
  styleUrls: ['./plugin-action-result-mappings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputModule,
    ValuePathSelectorComponent,
    InputLabelModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    LayerModule,
    SelectModule,
  ],
})
export class PluginActionResultMappingsComponent implements OnInit, OnDestroy {
  protected readonly testIds = PLUGIN_ACTION_RESULT_MAPPINGS_TEST_IDS;
  protected readonly ValuePathSelectorPrefix = ValuePathSelectorPrefix;

  private readonly formBuilder = inject(FormBuilder);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  @Input() public set mappings(value: Array<PluginActionResultMapping> | null | undefined) {
    const incoming = value ?? [];
    if (isEqual(incoming, this.currentMappings())) {
      return;
    }
    this.rebuildForm(incoming);
    this.scheduleControlRefresh();
  }

  @Input() public caseDefinitionKey: string | null | undefined;
  @Input() public caseDefinitionVersionTag: string | null | undefined;
  @Input() public buildingBlockDefinitionKey: string | null | undefined;
  @Input() public buildingBlockDefinitionVersionTag: string | null | undefined;

  /**
   * Keys the selected external action declares in its manifest `outputs`. When non-empty, the
   * source column renders as a dropdown restricted to these keys instead of a free-text JSON
   * pointer — the persisted value is still an RFC 6901 pointer (`/` + key) so the backend handler
   * stays untouched.
   */
  @Input() public set sourceKeys(value: Array<string> | null | undefined) {
    this._sourceKeys = value ?? [];
    this._sourceKeyItems = this._sourceKeys.map(key => ({id: key, text: key}));
    if (this.hasDeclaredSourceKeys) {
      // Keys can arrive after the rows (manifest lookup): rows created in free-text mode still
      // hold pointer-shaped sources ('/key') that the dropdown items ('key') would not match.
      this.mappingRows.controls.forEach(group => {
        const source = group.controls.source.value ?? '';
        if (source.startsWith('/')) {
          group.controls.source.setValue(source.replace(/^\//, ''), {emitEvent: false});
        }
      });
    }
    this.scheduleControlRefresh();
  }

  public get sourceKeys(): Array<string> {
    return this._sourceKeys;
  }

  public get hasDeclaredSourceKeys(): boolean {
    return this._sourceKeys.length > 0;
  }

  public get sourceKeyItems(): Array<SelectItem> {
    return this._sourceKeyItems;
  }

  private _sourceKeys: Array<string> = [];
  private _sourceKeyItems: Array<SelectItem> = [];

  @Output() public mappingsChangeEvent = new EventEmitter<Array<PluginActionResultMapping>>();

  /**
   * Emits whether the current rows are saveable: no rows at all is valid, but every present row
   * must have both a source and a target.
   */
  @Output() public validityChangeEvent = new EventEmitter<boolean>();

  public readonly mappingsForm: ResultMappingsFormGroup = this.formBuilder.group({
    mappings: this.formBuilder.array<ResultMappingRowFormGroup>([]),
  });

  public get mappingRows(): FormArray<ResultMappingRowFormGroup> {
    return this.mappingsForm.controls.mappings;
  }

  /**
   * Without a case or building-block context there is no document schema to browse, so the
   * target falls back to a free-text value-resolver key (typically `pv:`) — the same degradation
   * the building-block mapping step applies for independent processes.
   */
  public get hasDocumentContext(): boolean {
    return (
      !!(this.caseDefinitionKey && this.caseDefinitionVersionTag) ||
      !!(this.buildingBlockDefinitionKey && this.buildingBlockDefinitionVersionTag)
    );
  }

  private _subscriptions = new Subscription();
  private _refreshHandle: number | null = null;
  private _destroyed = false;

  public ngOnInit(): void {
    this._subscriptions.add(
      this.mappingsForm.valueChanges.subscribe(() => {
        this.mappingsChangeEvent.emit(this.currentMappings());
        this.validityChangeEvent.emit(this.isValid());
      })
    );
    this.validityChangeEvent.emit(this.isValid());
  }

  public ngOnDestroy(): void {
    this._destroyed = true;
    if (this._refreshHandle !== null) {
      clearTimeout(this._refreshHandle);
    }
    this._subscriptions.unsubscribe();
  }

  public addRow(): void {
    this.mappingRows.push(this.createRow());
    this.validityChangeEvent.emit(this.isValid());
    this.changeDetectorRef.detectChanges();
  }

  public deleteRow(index: number): void {
    this.mappingRows.removeAt(index);
    this.validityChangeEvent.emit(this.isValid());
    this.changeDetectorRef.detectChanges();
  }

  /**
   * Deferred re-sync after rows or dropdown items change outside a user event (prefill, late
   * manifest lookup): re-setting each control value once the current change-detection pass has
   * finished makes the select components pick up selections they missed while initializing, and
   * the explicit detectChanges renders it under OnPush. Mirrors the refresh
   * `ConfigureBuildingBlockMappingsComponent` applies to its own rows.
   */
  private scheduleControlRefresh(): void {
    if (this._refreshHandle !== null) {
      clearTimeout(this._refreshHandle);
    }
    this._refreshHandle = window.setTimeout(() => {
      this._refreshHandle = null;
      if (this._destroyed) return;
      this.mappingRows.controls.forEach(group => {
        group.controls.source.setValue(group.controls.source.value ?? '', {emitEvent: false});
        group.controls.target.setValue(group.controls.target.value ?? '', {emitEvent: false});
      });
      this.changeDetectorRef.detectChanges();
    }, 0);
  }

  private createRow(mapping?: PluginActionResultMapping): ResultMappingRowFormGroup {
    const source = mapping?.source ?? '';
    return this.formBuilder.group({
      source: new FormControl<string>(
        this.hasDeclaredSourceKeys ? source.replace(/^\//, '') : source,
        {nonNullable: true}
      ),
      target: new FormControl<string>(mapping?.target ?? '', {nonNullable: true}),
    });
  }

  private rebuildForm(mappings: Array<PluginActionResultMapping>): void {
    this.mappingRows.clear({emitEvent: false});
    mappings.forEach(mapping =>
      this.mappingRows.push(this.createRow(mapping), {emitEvent: false})
    );
  }

  private currentMappings(): Array<PluginActionResultMapping> {
    // Incomplete rows are emitted as-is (not silently dropped) — the validity event keeps the
    // save button disabled until every row carries both values.
    return this.mappingRows.controls.map(group => {
      const rawSource = group.controls.source.value?.trim() ?? '';
      const source =
        this.hasDeclaredSourceKeys && rawSource && !rawSource.startsWith('/')
          ? `/${rawSource}`
          : rawSource;
      return {
        source,
        target: group.controls.target.value?.trim() ?? '',
      };
    });
  }

  private isValid(): boolean {
    return this.currentMappings().every(mapping => !!mapping.source && !!mapping.target);
  }
}
