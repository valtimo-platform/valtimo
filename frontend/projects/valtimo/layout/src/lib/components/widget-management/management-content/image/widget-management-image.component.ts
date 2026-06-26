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
  Inject,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {
  InputLabelModule,
  MdiIconSelectorComponent,
  ValuePathSelectorComponent,
} from '@valtimo/components';
import {InputModule, LayerModule, ToggleModule} from 'carbon-components-angular';
import {debounceTime, Subscription} from 'rxjs';
import {WidgetImageContent} from '../../../../models';
import {WIDGET_MANAGEMENT_SERVICE} from '../../../../constants';
import {IWidgetManagementService} from '../../../../interfaces';
import {WidgetWizardService} from '../../../../services';

@Component({
  templateUrl: './widget-management-image.component.html',
  styleUrl: './widget-management-image.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    InputModule,
    InputLabelModule,
    LayerModule,
    ToggleModule,
    MdiIconSelectorComponent,
    ValuePathSelectorComponent,
  ],
})
export class WidgetManagementImageComponent implements OnInit, OnDestroy {
  @HostBinding('class') public readonly class = 'valtimo-widget-management-image';

  public readonly form = this.fb.group({
    widgetTitle: this.fb.control(this.widgetWizardService.$widgetTitle(), Validators.required),
    widgetIcon: this.fb.control(this.widgetWizardService.$widgetIcon()),
    value: this.fb.control(
      (this.widgetWizardService.$widgetContent() as WidgetImageContent)?.value ?? '',
      Validators.required
    ),
    displayAsCarousel: this.fb.control(
      (this.widgetWizardService.$widgetContent() as WidgetImageContent)?.displayAsCarousel ?? false
    ),
  });

  public readonly $widgetContext = this.widgetWizardService.$widgetContext;
  public readonly params$ = this.widgetManagementService.params$;

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly widgetWizardService: WidgetWizardService,
    @Inject(WIDGET_MANAGEMENT_SERVICE)
    private readonly widgetManagementService: IWidgetManagementService<any>
  ) {}

  public ngOnInit(): void {
    if (!this.widgetWizardService.$widgetWidth()) {
      this.widgetWizardService.$widgetWidth.set(2);
    }
    this.syncContentValid();

    this._subscriptions.add(
      this.form.valueChanges.pipe(debounceTime(100)).subscribe(formValue => {
        this.widgetWizardService.$widgetTitle.set(formValue.widgetTitle ?? '');
        this.widgetWizardService.$widgetIcon.set(formValue.widgetIcon ?? '');
        this.widgetWizardService.$widgetContent.set({
          value: formValue.value ?? '',
          displayAsCarousel: formValue.displayAsCarousel ?? false,
        } as WidgetImageContent);
        this.syncContentValid();
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  private syncContentValid(): void {
    this.widgetWizardService.$widgetContentValid.set(this.form.valid);
  }
}
