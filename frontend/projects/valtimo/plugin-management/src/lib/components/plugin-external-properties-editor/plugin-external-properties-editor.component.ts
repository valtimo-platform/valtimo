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
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {TagModule} from 'carbon-components-angular';
import {EditorModel, EditorModule} from '@valtimo/components';
import {
  ExternalPluginSchemaField,
  externalPluginSchemaFields,
} from '../../utils/external-plugin-properties-skeleton.util';

const SCHEMA_KEY = 'externalpluginproperties';

/**
 * Properties editor for plugins without a `config` bundle: the Monaco JSON editor, validated
 * against the plugin's configuration schema, plus an overview of the fields it declares.
 */
@Component({
  standalone: true,
  selector: 'valtimo-plugin-external-properties-editor',
  templateUrl: './plugin-external-properties-editor.component.html',
  styleUrls: ['./plugin-external-properties-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, TagModule, EditorModule],
})
export class PluginExternalPropertiesEditorComponent implements OnChanges {
  @Input() public value = '{}';
  @Input() public schema: unknown = null;
  @Input() public invalid = false;
  /** Edit mode: secrets are not sent back, so an absent secret means "unchanged". */
  @Input() public secretsKeptWhenEmpty = false;

  @Output() public valueChange = new EventEmitter<string>();

  public readonly $model = signal<EditorModel>({value: '{}', language: 'json'});
  public readonly $jsonSchema = signal<object | undefined>(undefined);
  public readonly $fields = signal<Array<ExternalPluginSchemaField>>([]);

  private readonly _uri = `inmemory://plugin-properties/${Math.random().toString(36).slice(2)}.${SCHEMA_KEY}.json`;
  private _lastEmitted: string | null = null;

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['schema']) {
      const schema = this.schema && typeof this.schema === 'object' ? this.schema : null;
      this.$jsonSchema.set(schema ? {...schema, $id: `${SCHEMA_KEY}.schema.json`} : undefined);
      this.$fields.set(externalPluginSchemaFields(schema));
    }
    // Only external value changes reset the editor; echoing our own edits back would move the cursor.
    if (changes['value'] && this.value !== this._lastEmitted) {
      this.$model.set({value: this.value ?? '{}', language: 'json', uri: this._uri});
    }
  }

  public onValueChange(value: string): void {
    this._lastEmitted = value;
    this.valueChange.emit(value);
  }

  public trackByKey(_index: number, field: ExternalPluginSchemaField): string {
    return field.key;
  }
}
