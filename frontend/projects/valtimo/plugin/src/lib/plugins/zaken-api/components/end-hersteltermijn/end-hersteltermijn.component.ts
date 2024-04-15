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
import {Observable, Subscription} from 'rxjs';
import {FunctionConfigurationComponent} from '../../../../models';
import {PluginTranslatePipe} from '../../../../pipes';

@Component({
  selector: 'valtimo-end-hersteltermijn',
  templateUrl: './end-hersteltermijn.component.html',
  providers: [PluginTranslatePipe],
})
export class EndHersteltermijnComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() disabled$: Observable<boolean>;
  @Input() save$: Observable<void>;
  @Input() prefillConfiguration$: Observable<any>;
  @Input() pluginId: string;

  @Output() configuration: EventEmitter<any> = new EventEmitter<any>();
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();

  private _saveSubscription = new Subscription();

  public ngOnInit(): void {
    this.openSaveSubscription();
    this.emitValid();
  }

  public ngOnDestroy(): void {
    this._saveSubscription.unsubscribe();
  }

  private emitValid(): void {
    this.valid.emit(true);
  }

  private openSaveSubscription(): void {
    this._saveSubscription.add(
      this.save$?.subscribe(() => {
        this.configuration.emit({});
      })
    );
  }
}
