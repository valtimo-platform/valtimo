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
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {
  InputLabelModule,
  MdiIconSelectorComponent,
  ValuePathSelectorComponent,
} from '@valtimo/components';
import {ButtonModule, IconModule, InputModule, LayerModule} from 'carbon-components-angular';
import {debounceTime, Subscription} from 'rxjs';
import {WIDGET_CONTENT_PERSON_CARD_TEST_IDS, WIDGET_MANAGEMENT_SERVICE} from '../../../../constants';
import {IWidgetManagementService} from '../../../../interfaces';
import {PersonCardContactField, WidgetPersonCardContent} from '../../../../models';
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
    ButtonModule,
    IconModule,
  ],
})
export class WidgetManagementPersonCardComponent implements OnInit, OnDestroy {
  protected readonly testIds = WIDGET_CONTENT_PERSON_CARD_TEST_IDS;

  @HostBinding('class') public readonly class = 'valtimo-widget-management-person-card';

  public readonly $showTitleInput = signal<boolean>(true);
  public readonly $widgetContext = this.widgetWizardService.$widgetContext;
  public readonly params$ = this.widgetManagementService.params$;

  public form = this.fb.group({
    widgetTitle: this.fb.control(this.widgetWizardService.$widgetTitle(), Validators.required),
    widgetIcon: this.fb.control(this.widgetWizardService.$widgetIcon()),
    firstInitialPath: this.fb.control(
      (this.widgetWizardService.$widgetContent() as WidgetPersonCardContent)?.avatar
        ?.firstInitialPath ?? '',
      Validators.required
    ),
    secondInitialPath: this.fb.control(
      (this.widgetWizardService.$widgetContent() as WidgetPersonCardContent)?.avatar
        ?.secondInitialPath ?? '',
      Validators.required
    ),
    displayNamePath: this.fb.control(
      (this.widgetWizardService.$widgetContent() as WidgetPersonCardContent)?.heading
        ?.displayNamePath ?? '',
      Validators.required
    ),
    subtitlePath: this.fb.control(
      (this.widgetWizardService.$widgetContent() as WidgetPersonCardContent)?.heading
        ?.subtitlePath ?? ''
    ),
    contactFields: this.fb.array<FormGroup>([]),
    householdArrayPath: this.fb.control(
      (this.widgetWizardService.$widgetContent() as WidgetPersonCardContent)?.household
        ?.arrayPath ?? '',
      Validators.required
    ),
    householdItemNamePath: this.fb.control(
      (this.widgetWizardService.$widgetContent() as WidgetPersonCardContent)?.household
        ?.itemNamePath ?? '',
      Validators.required
    ),
    householdItemSubtitlePath: this.fb.control(
      (this.widgetWizardService.$widgetContent() as WidgetPersonCardContent)?.household
        ?.itemSubtitlePath ?? ''
    ),
  });

  public get contactFields(): FormArray {
    return this.form.get('contactFields') as FormArray;
  }

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly widgetWizardService: WidgetWizardService,
    @Inject(WIDGET_MANAGEMENT_SERVICE)
    private readonly widgetManagementService: IWidgetManagementService<any>
  ) {}

  public ngOnInit(): void {
    if (this.widgetWizardService.$disableTitleInput()) this.hideTitleInput();

    this.initContactFields();

    this.widgetWizardService.$widgetContentValid.set(this.form.valid);

    this._subscriptions.add(
      this.form.valueChanges.pipe(debounceTime(100)).subscribe(formValue => {
        this.widgetWizardService.$widgetTitle.set(formValue.widgetTitle ?? '');
        this.widgetWizardService.$widgetIcon.set(formValue.widgetIcon ?? '');
        this.widgetWizardService.$widgetContent.set({
          avatar: {
            firstInitialPath: formValue.firstInitialPath ?? '',
            secondInitialPath: formValue.secondInitialPath ?? '',
          },
          heading: {
            displayNamePath: formValue.displayNamePath ?? '',
            subtitlePath: formValue.subtitlePath ?? '',
          },
          contactFields: (formValue.contactFields ?? []) as PersonCardContactField[],
          household: {
            arrayPath: formValue.householdArrayPath ?? '',
            itemNamePath: formValue.householdItemNamePath ?? '',
            itemSubtitlePath: formValue.householdItemSubtitlePath ?? '',
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

  public onAddContactFieldClick(): void {
    this.contactFields.push(this.buildContactFieldGroup());
  }

  public onDeleteContactFieldClick(index: number): void {
    this.contactFields.removeAt(index);
  }

  private initContactFields(): void {
    const existing = (this.widgetWizardService.$widgetContent() as WidgetPersonCardContent)
      ?.contactFields;
    if (!existing?.length) return;

    existing.forEach(field =>
      this.contactFields.push(this.buildContactFieldGroup(field), {emitEvent: false})
    );
  }

  private buildContactFieldGroup(field?: PersonCardContactField): FormGroup {
    return this.fb.group({
      icon: this.fb.control(field?.icon ?? '', Validators.required),
      label: this.fb.control(field?.label ?? '', Validators.required),
      sourcePath: this.fb.control(field?.sourcePath ?? '', Validators.required),
    });
  }

  private hideTitleInput(): void {
    this.$showTitleInput.set(false);

    const ctrl: AbstractControl | null = this.form.get('widgetTitle');
    if (!ctrl) return;

    ctrl.clearValidators();
    ctrl.updateValueAndValidity({emitEvent: false});

    this.widgetWizardService.$widgetContentValid.set(this.form.valid);
  }
}
