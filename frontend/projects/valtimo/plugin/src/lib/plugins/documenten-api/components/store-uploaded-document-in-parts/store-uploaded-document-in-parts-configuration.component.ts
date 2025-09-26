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
import {FunctionConfigurationComponent} from '../../../../models';
import {Observable, Subscription} from 'rxjs';

@Component({
  selector: 'valtimo-store-uploaded-document-in-parts-configuration',
  templateUrl: './store-uploaded-document-in-parts-configuration.component.html',
})
export class StoreUploadedDocumentInPartsConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<any>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<any> = new EventEmitter<any>();

  private saveSubscription!: Subscription;

  public ngOnInit(): void {
    this.openSaveSubscription();
    this.emitValid();
  }

  public ngOnDestroy(): void {
    this.saveSubscription?.unsubscribe();
  }

  private emitValid(): void {
    this.valid.emit(true);
  }

  private openSaveSubscription(): void {
    this.saveSubscription = this.save$?.subscribe(() => {
      this.configuration.emit({});
    });
  }
}
