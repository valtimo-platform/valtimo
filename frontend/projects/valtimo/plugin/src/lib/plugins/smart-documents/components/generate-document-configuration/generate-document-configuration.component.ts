/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {
  FunctionConfigurationComponent,
  FunctionConfigurationData,
  PluginConfigurationComponent,
  PluginConfigurationData,
} from '../../../../models';
import {BehaviorSubject, combineLatest, Observable, Subscription, take} from 'rxjs';
import {DocumentFormat, GenerateDocumentConfig, SmartDocumentsConfig} from '../../models';

@Component({
  selector: 'valtimo-generate-document-configuration',
  templateUrl: './generate-document-configuration.component.html',
  styleUrls: ['./generate-document-configuration.component.scss'],
})
export class GenerateDocumentConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<GenerateDocumentConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<GenerateDocumentConfig> =
    new EventEmitter<GenerateDocumentConfig>();

  readonly FORMATS: Array<DocumentFormat> = ['DOCX', 'HTML', 'PDF', 'XML'];
  readonly FORMAT_SELECT_ITEMS: Array<{id: string; text: string}> = this.FORMATS.map(format => ({
    id: format,
    text: format,
  }));

  private saveSubscription!: Subscription;
  private readonly formValue$ = new BehaviorSubject<GenerateDocumentConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  ngOnInit(): void {
    this.openSaveSubscription();
  }

  ngOnDestroy(): void {
    this.saveSubscription?.unsubscribe();
  }

  formValueChange(formValue: GenerateDocumentConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  private handleValid(formValue: GenerateDocumentConfig): void {
    const valid = !!(
      formValue.templateGroup &&
      formValue.templateName &&
      formValue.format &&
      formValue.resultingDocumentProcessVariableName &&
      formValue.templateData?.length > 0
    );

    this.valid$.next(valid);
    this.valid.emit(valid);
  }

  private openSaveSubscription(): void {
    this.saveSubscription = this.save$?.subscribe(save => {
      combineLatest([this.formValue$, this.valid$])
        .pipe(take(1))
        .subscribe(([formValue, valid]) => {
          if (valid) {
            this.configuration.emit(formValue);
          }
        });
    });
  }
}
