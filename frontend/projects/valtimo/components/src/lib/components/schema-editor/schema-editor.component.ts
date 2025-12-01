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
import {ButtonModule} from 'carbon-components-angular';
import {BehaviorSubject} from 'rxjs';
import {TranslatePipe} from '@ngx-translate/core';
import {ConfirmationModalModule} from '../confirmation-modal/confirmation-modal.module';

@Component({
  selector: 'valtimo-schema-editor',
  standalone: true,
  imports: [CommonModule, ButtonModule, TranslatePipe, ConfirmationModalModule],
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

  private toggleRequired(property: string, makeRequired: boolean): void {
    let schema = JSON.parse(this._modifiedValue || this.schemaJson);

    if (!schema.required) schema.required = [];

    const idx = schema.required.indexOf(property);

    if (makeRequired && idx === -1) schema.required.push(property);
    if (!makeRequired && idx !== -1) schema.required.splice(idx, 1);

    this._modifiedValue = JSON.stringify(schema, null, 2);
    this._editor.updateProps({content: {text: this._modifiedValue}});
    this.changeEvent.emit(this._modifiedValue);
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
}
