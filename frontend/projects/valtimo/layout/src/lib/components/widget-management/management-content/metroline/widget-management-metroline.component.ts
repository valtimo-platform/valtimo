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
import {FormBuilder, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {InputLabelModule, MdiIconSelectorComponent} from '@valtimo/components';
import {
  DropdownModule,
  InputModule,
  LayerModule,
  ListItem,
  RadioModule,
} from 'carbon-components-angular';
import {combineLatest, debounceTime, map, Observable, Subscription} from 'rxjs';
import {
  METROLINE_MODE_OPTIONS,
  METROLINE_MODE_TRANSLATION_KEYS,
  WIDGET_CONTENT_METROLINE_TEST_IDS,
} from '../../../../constants';
import {
  MetrolineMode,
  MetrolineOrientation,
  WidgetIkoMetrolineContent,
  WidgetMetrolineContent,
} from '../../../../models';
import {MetrolineWidgetApiService, WidgetWizardService} from '../../../../services';

@Component({
  templateUrl: './widget-management-metroline.component.html',
  styleUrl: './widget-management-metroline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    DropdownModule,
    FormsModule,
    InputLabelModule,
    InputModule,
    LayerModule,
    MdiIconSelectorComponent,
    RadioModule,
    ReactiveFormsModule,
    TranslateModule,
  ],
})
export class WidgetManagementMetrolineComponent implements OnDestroy, OnInit {
  @HostBinding('class') public readonly class = 'valtimo-widget-management-metroline';

  protected readonly testIds = WIDGET_CONTENT_METROLINE_TEST_IDS;
  protected readonly orientationOptions = MetrolineOrientation;
  protected readonly MetrolineMode = MetrolineMode;

  public readonly $widgetContext = this.widgetWizardService.$widgetContext;

  private readonly _initialContent = this.widgetWizardService.$widgetContent() as
    | WidgetMetrolineContent
    | WidgetIkoMetrolineContent
    | null;

  private readonly _initialCaseContent = this._initialContent as WidgetMetrolineContent | null;
  private readonly _initialIkoContent = this._initialContent as WidgetIkoMetrolineContent | null;

  public readonly form = this.fb.group({
    widgetTitle: this.fb.control(this.widgetWizardService.$widgetTitle(), Validators.required),
    widgetIcon: this.fb.control(this.widgetWizardService.$widgetIcon()),
    orientation: this.fb.control<MetrolineOrientation>(
      this._initialContent?.orientation ?? MetrolineOrientation.HORIZONTAL,
      Validators.required
    ),
    mode: this.fb.control<MetrolineMode | null>(
      this._initialCaseContent?.mode ?? null,
      Validators.required
    ),
    source: this.fb.control<string>(this._initialIkoContent?.source ?? ''),
    titlePath: this.fb.control<string>(this._initialIkoContent?.titlePath ?? ''),
    labelPath: this.fb.control<string | null>(this._initialIkoContent?.labelPath ?? null),
    completedPath: this.fb.control<string>(this._initialIkoContent?.completedPath ?? ''),
  });

  public readonly modeItems$: Observable<ListItem[]> = combineLatest([
    this.metrolineWidgetApiService.getAvailableModes(),
    this.translateService.stream('key'),
  ]).pipe(map(([availableModes]) => this.buildModeItems(availableModes)));

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly metrolineWidgetApiService: MetrolineWidgetApiService,
    private readonly translateService: TranslateService,
    private readonly widgetWizardService: WidgetWizardService
  ) {}

  public ngOnInit(): void {
    if (this.$widgetContext() === 'iko') {
      // Mode is irrelevant for IKO widgets: the data shape (per-item completedPath) drives rendering.
      this.form.controls.mode.clearValidators();
      this.form.controls.mode.updateValueAndValidity({emitEvent: false});
      this.form.controls.source.addValidators(Validators.required);
      this.form.controls.titlePath.addValidators(Validators.required);
      this.form.controls.completedPath.addValidators(Validators.required);
      this.form.controls.source.updateValueAndValidity({emitEvent: false});
      this.form.controls.titlePath.updateValueAndValidity({emitEvent: false});
      this.form.controls.completedPath.updateValueAndValidity({emitEvent: false});
    }

    this.syncWizardServiceFromForm();
    this.widgetWizardService.$widgetContentValid.set(this.form.valid);

    this._subscriptions.add(
      this.form.valueChanges.pipe(debounceTime(100)).subscribe(() => {
        this.syncWizardServiceFromForm();
        this.widgetWizardService.$widgetContentValid.set(this.form.valid);
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.form.reset();
    this.widgetWizardService.$widgetContentValid.set(false);
  }

  public onModeSelected(event: {item: ListItem}): void {
    if (!event?.item?.id) return;
    this.form.patchValue({mode: event.item.id as MetrolineMode});
  }

  public onOrientationChange(value: MetrolineOrientation): void {
    this.form.controls.orientation.setValue(value);
  }

  private syncWizardServiceFromForm(): void {
    const value = this.form.getRawValue();
    this.widgetWizardService.$widgetTitle.set(value.widgetTitle ?? '');
    this.widgetWizardService.$widgetIcon.set(value.widgetIcon ?? '');

    if (this.$widgetContext() === 'iko') {
      this.widgetWizardService.$widgetContent.set({
        orientation: value.orientation ?? MetrolineOrientation.HORIZONTAL,
        source: value.source ?? '',
        titlePath: value.titlePath ?? '',
        labelPath: value.labelPath || null,
        completedPath: value.completedPath ?? '',
      } as WidgetIkoMetrolineContent);
    } else {
      this.widgetWizardService.$widgetContent.set({
        orientation: value.orientation ?? MetrolineOrientation.HORIZONTAL,
        mode: value.mode,
      } as WidgetMetrolineContent);
    }
  }

  private buildModeItems(availableModes: MetrolineMode[]): ListItem[] {
    const current = this.form.get('mode')?.value;
    const visible = new Set<MetrolineMode>(availableModes);
    if (current) visible.add(current);

    return METROLINE_MODE_OPTIONS.filter(mode => visible.has(mode)).map(mode => ({
      content: this.translateService.instant(METROLINE_MODE_TRANSLATION_KEYS[mode]),
      id: mode,
      selected: current === mode,
    }));
  }
}
