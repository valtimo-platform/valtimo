/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import type {Content} from 'vanilla-jsoneditor';
import {createJSONEditor} from 'vanilla-jsoneditor';
import Ajv from 'ajv';
import {
  ButtonModule,
  CheckboxModule,
  DialogModule,
  IconModule,
  InputModule,
  TagModule,
} from 'carbon-components-angular';
import {BehaviorSubject} from 'rxjs';
import {TranslatePipe} from '@ngx-translate/core';
import {ConfirmationModalModule} from '../confirmation-modal/confirmation-modal.module';

interface SchemaPropertyEntry {
  path: string; // e.g. "contactmomenten[].kanaal"
  label: string; // e.g. "contactmomenten → kanaal"
  required: boolean; // whether it's currently required
}

interface ParentSchemaResult {
  parent: any;
  key: string;
}

@Component({
  selector: 'valtimo-schema-editor',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TranslatePipe,
    ConfirmationModalModule,
    DialogModule,
    CheckboxModule,
    IconModule,
    InputModule,
    TagModule,
  ],
  templateUrl: './schema-editor.component.html',
  styleUrl: './schema-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemaEditorComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('host', {static: true}) public readonly hostEl!: ElementRef<HTMLDivElement>;

  @Input() public schemaJson = '{ "type": "object", "properties": {} }';
  @Input() public disabled = false;

  @Output() public changeEvent = new EventEmitter<string>();
  @Output() public saveEvent = new EventEmitter<string>();
  @Output() public validEvent = new EventEmitter<boolean>();

  private _editor!: any;

  private readonly _ajv = new Ajv();

  public readonly showSaveConfirmationModal$ = new BehaviorSubject<boolean>(false);

  public readonly valid$ = new BehaviorSubject<boolean>(false);
  private get _valid(): boolean {
    return this.valid$.getValue();
  }

  private _modifiedValue: string = '';

  public readonly requiredProperties$ = new BehaviorSubject<SchemaPropertyEntry[]>([]);

  constructor(private readonly zone: NgZone) {}

  public ngAfterViewInit(): void {
    const initial: Content = {text: this.schemaJson};

    this._editor = createJSONEditor({
      target: this.hostEl.nativeElement,
      props: {
        content: initial,
        mode: 'tree',
        mainMenuBar: true,
        navigationBar: true,
        readOnly: this.disabled,
        onChange: (updated, _prev) => {
          this.zone.run(() => {
            const text =
              'text' in updated && typeof updated.text === 'string'
                ? updated.text
                : JSON.stringify('json' in updated ? updated.json : {}, null, 2);

            const valid = Boolean(this._ajv.validateSchema(JSON.parse(text)));

            this.valid$.next(valid);
            this.validEvent.emit(valid);

            if (!valid) {
              console.warn(this._ajv.errors);
            }

            this.changeEvent.emit(text);
            this._modifiedValue = text;

            this.rebuildRequiredList(text);
          });
        },
      },
    });
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (!this._editor) return;

    if (changes['schemaJson'] && !changes['schemaJson'].firstChange) {
      this._editor.updateProps({
        content: {text: this.schemaJson},
      });
    }

    if (changes['disabled'] && !changes['disabled'].firstChange) {
      this._editor.updateProps({
        readOnly: this.disabled,
      });
    }
  }

  public ngOnDestroy(): void {
    if (this._editor) this._editor.destroy?.();
  }

  public onSaveClick(): void {
    if (this.disabled) return;
    this.showSaveConfirmationModal$.next(true);
  }

  public hideConfirmationModal(): void {
    this.showSaveConfirmationModal$.next(false);
  }

  public onSaveChanges(): void {
    if (this.disabled || !this._valid || !this._modifiedValue) return;
    this.saveEvent.emit(this._modifiedValue);
  }

  public onRequiredToggle(entry: SchemaPropertyEntry, checked: boolean): void {
    if (this.disabled) return;

    let schema: any;
    try {
      schema = JSON.parse(this._modifiedValue || this.schemaJson);
    } catch {
      return;
    }

    this.updateRequiredForPath(schema, entry.path, checked);

    const text = JSON.stringify(schema, null, 2);

    // Push back into the editor
    this._editor.updateProps({content: {text}});
    this._modifiedValue = text;
    this.changeEvent.emit(text);

    const valid = Boolean(this._ajv.validateSchema(schema));
    this.valid$.next(valid);
    this.validEvent.emit(valid);

    this.rebuildRequiredList(text);
  }

  public collectSchemaProperties(schema: any, basePath = ''): SchemaPropertyEntry[] {
    const result: SchemaPropertyEntry[] = [];

    if (!schema || typeof schema !== 'object') return result;

    const isObject = schema.type === 'object' || schema.properties;
    if (!isObject || !schema.properties) return result;

    const requiredSet = new Set<string>(schema.required || []);

    Object.entries<any>(schema.properties).forEach(([key, propSchema]) => {
      const currentPath = basePath ? `${basePath}.${key}` : key;
      const label = currentPath.replace(/\.\[\]/g, '[]').replace(/\./g, ' → ');
      const isRequired = requiredSet.has(key);

      result.push({
        path: currentPath,
        label,
        required: isRequired,
      });

      // Nested object
      if (propSchema && typeof propSchema === 'object') {
        if (propSchema.type === 'object' || propSchema.properties) {
          result.push(...this.collectSchemaProperties(propSchema, currentPath));
        }

        // Array of objects
        if (propSchema.type === 'array' && propSchema.items) {
          const itemsBasePath = `${currentPath}[]`;
          result.push(...this.collectSchemaProperties(propSchema.items, itemsBasePath));
        }
      }
    });

    return result;
  }

  public findParentSchemaForPath(rootSchema: any, path: string): ParentSchemaResult | null {
    if (!rootSchema || typeof rootSchema !== 'object') return null;

    const segments = path.split('.');
    if (segments.length === 0) return null;

    // Last segment is the property name (may be something like "field" or "field[]")
    const lastSegment = segments[segments.length - 1];
    const key = lastSegment.endsWith('[]') ? lastSegment.slice(0, -2) : lastSegment;

    let parent: any = rootSchema;

    // Walk all but last segment to find the parent schema node
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      const isArraySeg = seg.endsWith('[]');
      const name = isArraySeg ? seg.slice(0, -2) : seg;

      if (!parent.properties || !parent.properties[name]) {
        return null;
      }

      const next = parent.properties[name];

      if (isArraySeg) {
        parent = next.items ?? next;
      } else {
        parent = next;
      }

      if (!parent || typeof parent !== 'object') {
        return null;
      }
    }

    return {parent, key};
  }

  public updateRequiredForPath(rootSchema: any, path: string, makeRequired: boolean): any {
    const result = this.findParentSchemaForPath(rootSchema, path);
    if (!result) return rootSchema;

    const {parent, key} = result;

    const existing = Array.isArray(parent.required) ? [...parent.required] : [];
    const idx = existing.indexOf(key);

    if (makeRequired && idx === -1) {
      existing.push(key);
    } else if (!makeRequired && idx !== -1) {
      existing.splice(idx, 1);
    }

    if (existing.length > 0) {
      parent.required = existing;
    } else {
      delete parent.required;
    }

    return rootSchema;
  }

  public isRequired(property: string): boolean {
    try {
      const schema = JSON.parse(this._modifiedValue || this.schemaJson);
      return Array.isArray(schema.required) && schema.required.includes(property);
    } catch {
      return false;
    }
  }

  public getProperties(): string[] {
    try {
      const schema = JSON.parse(this._modifiedValue || this.schemaJson);
      return schema?.properties ? Object.keys(schema.properties) : [];
    } catch {
      return [];
    }
  }

  private rebuildRequiredList(schemaText: string): void {
    try {
      const schema = JSON.parse(schemaText);
      const props = this.collectSchemaProperties(schema);
      this.requiredProperties$.next(props);
    } catch {
      this.requiredProperties$.next([]);
    }
  }
}
