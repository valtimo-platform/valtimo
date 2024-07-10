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
import {ConfigurationOutput, DisplayTypeConfigurationComponent} from '../../../../models';
import {startWith, Subscription} from 'rxjs';
import {AbstractControl, FormBuilder, Validators} from '@angular/forms';
import {BarChartDisplayTypeProperties} from '../../models';

@Component({
  templateUrl: './bar-chart-configuration.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarChartConfigurationComponent
  implements OnInit, OnDestroy, DisplayTypeConfigurationComponent
{
  public readonly form = this.fb.group({
    title: this.fb.control('', [Validators.required]),
    subtitle: this.fb.control(''),
  });

  @Input() public readonly displayTypeKey: string;

  @Input() set disabled(disabledValue: boolean) {
    if (disabledValue) {
      this.form.disable();
    } else {
      this.form.enable();
    }
  }

  public get title(): AbstractControl<string> {
    return this.form.get('title');
  }

  public get subtitle(): AbstractControl<string> {
    return this.form.get('subtitle');
  }

  @Input() set prefillConfiguration(configurationValue: BarChartDisplayTypeProperties) {
    if (configurationValue) {
      this.title.setValue(configurationValue.title || '');
      this.subtitle.setValue(configurationValue.subtitle || '');
    }
  }

  @Output() public configurationEvent = new EventEmitter<
    ConfigurationOutput<BarChartDisplayTypeProperties>
  >();

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
        this.configurationEvent.emit({
          valid: this.form.valid,
          data: formValue as BarChartDisplayTypeProperties,
        });
      })
    );
  }
}
