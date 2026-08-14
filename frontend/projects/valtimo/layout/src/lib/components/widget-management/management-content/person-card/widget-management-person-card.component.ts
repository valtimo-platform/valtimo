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
  signal,
  ViewEncapsulation,
} from '@angular/core';
import {AbstractControl, FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {
  InputLabelModule,
  MdiIconSelectorComponent,
  ValuePathSelectorComponent, ValuePathSelectorPrefix,
} from '@valtimo/components';
import {InputModule, LayerModule} from 'carbon-components-angular';
import {debounceTime, Subscription} from 'rxjs';
import {WIDGET_CONTENT_PERSON_CARD_TEST_IDS, WIDGET_MANAGEMENT_SERVICE} from '../../../../constants';
import {IWidgetManagementService} from '../../../../interfaces';
import {WidgetPersonCardContent} from '../../../../models';
import {WidgetWizardService} from '../../../../services';

@Component({
  templateUrl: './widget-management-person-card.component.html',
  styleUrl: './widget-management-person-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    InputModule,
    InputLabelModule,
    MdiIconSelectorComponent,
    ValuePathSelectorComponent,
    LayerModule,
  ],
})
export class WidgetManagementPersonCardComponent implements OnInit, OnDestroy {
  protected readonly testIds = WIDGET_CONTENT_PERSON_CARD_TEST_IDS;

  @HostBinding('class') public readonly class = 'valtimo-widget-management-person-card';

  public readonly $showTitleInput = signal<boolean>(true);
  public readonly params$ = this.widgetManagementService.params$;

  private get person() {
    return (this.widgetWizardService.$widgetContent() as WidgetPersonCardContent | null)?.person;
  }

  public form = this.fb.group({
    widgetTitle: this.fb.control(this.widgetWizardService.$widgetTitle(), Validators.required),
    widgetIcon: this.fb.control(this.widgetWizardService.$widgetIcon()),
    fullName: this.fb.control(this.person?.fullName ?? '', Validators.required),
    birthDate: this.fb.control(this.person?.birthDate ?? ''),
    bsn: this.fb.control(this.person?.bsn ?? ''),
    phone: this.fb.control(this.person?.phone ?? ''),
    email: this.fb.control(this.person?.email ?? ''),
    city: this.fb.control(this.person?.city ?? ''),
  });

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly widgetWizardService: WidgetWizardService,
    @Inject(WIDGET_MANAGEMENT_SERVICE)
    private readonly widgetManagementService: IWidgetManagementService<any>
  ) {}

  public ngOnInit(): void {
    if (this.widgetWizardService.$disableTitleInput()) this.hideTitleInput();

    this.widgetWizardService.$widgetContentValid.set(this.form.valid);

    this._subscriptions.add(
      this.form.valueChanges.pipe(debounceTime(100)).subscribe(formValue => {
        this.widgetWizardService.$widgetTitle.set(formValue.widgetTitle ?? '');
        this.widgetWizardService.$widgetIcon.set(formValue.widgetIcon ?? '');
        this.widgetWizardService.$widgetContent.set({
          person: {
            fullName: formValue.fullName ?? '',
            birthDate: formValue.birthDate || undefined,
            bsn: formValue.bsn || undefined,
            phone: formValue.phone || undefined,
            email: formValue.email || undefined,
            city: formValue.city || undefined,
          },
        } as WidgetPersonCardContent);
        this.widgetWizardService.$widgetContentValid.set(this.form.valid);
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.form.reset();
  }

  private hideTitleInput(): void {
    this.$showTitleInput.set(false);

    const ctrl: AbstractControl | null = this.form.get('widgetTitle');
    if (!ctrl) return;

    ctrl.clearValidators();
    ctrl.updateValueAndValidity({emitEvent: false});

    this.widgetWizardService.$widgetContentValid.set(this.form.valid);
  }

  protected readonly ValuePathSelectorPrefix = ValuePathSelectorPrefix;
}
