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
import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {InputLabelModule} from '@valtimo/components';
import {InputModule} from 'carbon-components-angular';
import {debounceTime, Subscription} from 'rxjs';
import {WidgetWizardService} from '../../../../services';

@Component({
  templateUrl: './widget-management-progress.component.html',
  styleUrl: './widget-management-progress.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    InputModule,
    ReactiveFormsModule,
    InputLabelModule,
  ],
})
export class WidgetManagementProgressComponent implements OnDestroy, OnInit {
  @HostBinding('class') public readonly class = 'valtimo-widget-management-progress';

  public form = this.fb.group({
    widgetTitle: this.fb.control(this.widgetWizardService.$widgetTitle(), Validators.required),
  });

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly widgetWizardService: WidgetWizardService
  ) {}

  public ngOnInit(): void {
    this.widgetWizardService.$widgetContentValid.set(false);

    this._subscriptions.add(
      this.form.valueChanges.pipe(debounceTime(100)).subscribe(formValue => {
        this.widgetWizardService.$widgetTitle.set(formValue.widgetTitle ?? '');
        this.widgetWizardService.$widgetContentValid.set(this.form.valid);
      })
    );

    this.widgetWizardService.$widgetContentValid.set(this.form.valid);
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.form.reset();
  }
}
