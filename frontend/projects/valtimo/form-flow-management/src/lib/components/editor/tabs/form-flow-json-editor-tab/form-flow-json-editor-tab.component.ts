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
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {EditorModel, EditorModule} from '@valtimo/components';
import {editor} from 'monaco-editor';

@Component({
  standalone: true,
  selector: 'valtimo-form-flow-json-editor-tab',
  templateUrl: './form-flow-json-editor-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, EditorModule],
})
export class FormFlowJsonEditorTabComponent {
  @Input() public disabled: boolean | null = false;
  @Input() public model!: EditorModel;
  @Input() public schema: object | null = null;

  @Output() public validEvent = new EventEmitter<boolean>();
  @Output() public valueChangeEvent = new EventEmitter<string>();

  public readonly editorOptions: editor.IEditorOptions = {
    quickSuggestions: {other: true, comments: false, strings: true},
  };

  public onValid(valid: boolean): void {
    this.validEvent.emit(valid);
  }

  public onValueChange(value: string): void {
    this.valueChangeEvent.emit(value);
  }
}
