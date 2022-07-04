/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.See the License for the specific language governing permissions and limitations under the License.
 */

import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FunctionConfigurationComponent, PluginConfigurationComponent} from '../../../../models';
import {Observable} from 'rxjs';
import {DocumentFormat, GenerateDocumentConfig} from '../../models';

@Component({
  selector: 'valtimo-generate-document-configuration',
  templateUrl: './generate-document-configuration.component.html',
  styleUrls: ['./generate-document-configuration.component.scss'],
})
export class GenerateDocumentConfigurationComponent implements FunctionConfigurationComponent {
  @Input() clear$: Observable<void>;
  @Input() save$: Observable<void>;
  @Input() disabled: boolean;
  @Input() error: boolean;
  @Input() pluginId: string;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<GenerateDocumentConfig> =
    new EventEmitter<GenerateDocumentConfig>();

  readonly FORMATS: Array<DocumentFormat> = ['DOCX', 'HTML', 'PDF', 'XML'];
  readonly FORMAT_SELECT_ITEMS: Array<{id: string; text: string}> = this.FORMATS.map(format => ({
    id: format,
    text: format,
  }));

  formValueChange(formValue: GenerateDocumentConfig): void {
    this.configuration.emit(formValue);
    this.handleValid(formValue);
  }

  private handleValid(formValue: GenerateDocumentConfig): void {
    const valid =
      formValue.templateGroup &&
      formValue.templateName &&
      formValue.format &&
      formValue.templateData.length > 0;

    this.valid.emit(!!valid);
  }
}
