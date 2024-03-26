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

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {ConfigurationOutput, DataSourceConfigurationComponent} from '../../../../models';
import {startWith, Subscription} from 'rxjs';
import {FormBuilder, Validators} from '@angular/forms';
import {TestConfiguration} from '../../models';

@Component({
  templateUrl: './test-configuration.component.html',
  styleUrls: ['./test-configuration.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestConfigurationComponent
  implements OnInit, OnDestroy, DataSourceConfigurationComponent
{
  public readonly form = this.fb.group({
    value: this.fb.control(null, [Validators.required]),
    total: this.fb.control(null, [Validators.required]),
  });

  @Input() dataSourceKey: string;
  @Input() set disabled(disabledValue: boolean) {
    if (disabledValue) {
      this.form.disable();
    } else {
      this.form.enable();
    }
  }

  public get value() {
    return this.form.get('value');
  }

  public get total() {
    return this.form.get('total');
  }

  @Input() set prefillConfiguration(configurationValue: TestConfiguration) {
    if (configurationValue) {
      this.value.setValue(configurationValue.value);
      this.total.setValue(configurationValue.total);
    }
  }

  @Output() public configurationEvent = new EventEmitter<ConfigurationOutput>();

  private _subscriptions = new Subscription();

  constructor(private readonly fb: FormBuilder) {}

  public ngOnInit(): void {
    this.openFormSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  private openFormSubscription(): void {
    this._subscriptions.add(
      this.form.valueChanges.pipe(startWith(this.form.value)).subscribe(formValue => {
        this.configurationEvent.emit({valid: this.form.valid, data: formValue});
      })
    );
  }
}
