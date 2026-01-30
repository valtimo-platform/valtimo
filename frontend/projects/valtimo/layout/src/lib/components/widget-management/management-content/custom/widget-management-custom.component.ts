/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
  effect,
  Inject,
  OnDestroy,
  OnInit,
  Optional,
  signal,
} from '@angular/core';
import {toObservable} from '@angular/core/rxjs-interop';
import {AbstractControl, FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {
  CARBON_THEME,
  CarbonMultiInputModule,
  CdsThemeService,
  CurrentCarbonTheme,
  InputLabelModule,
  MdiIconSelectorComponent,
  MultiInputKeyValue,
} from '@valtimo/components';
import {
  DropdownModule,
  InputModule,
  LayerModule,
  ListItem,
  SelectModule,
} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, filter, map, Observable, Subscription} from 'rxjs';
import {CUSTOM_WIDGET_TOKEN} from '../../../../constants';
import {CustomWidgetConfig, WidgetContentProperties, WidgetCustomContent} from '../../../../models';
import {WidgetWizardService} from '../../../../services';

@Component({
  templateUrl: './widget-management-custom.component.html',
  styleUrls: ['./widget-management-custom.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    InputModule,
    ReactiveFormsModule,
    SelectModule,
    DropdownModule,
    LayerModule,
    MdiIconSelectorComponent,
    InputLabelModule,
    CarbonMultiInputModule,
  ],
})
export class WidgetManagementCustomComponent implements OnDestroy, OnInit {
  public readonly form = this.fb.group({
    widgetTitle: this.fb.control(this.widgetWizardService.$widgetTitle(), Validators.required),
    widgetIcon: this.fb.control(this.widgetWizardService.$widgetIcon()),
  });

  public get widgetTitle(): AbstractControl<string | null, string | null> | null {
    return this.form.get('widgetTitle');
  }

  public get widgetIcon(): AbstractControl<string | null, string | null> | null {
    return this.form.get('widgetIcon');
  }

  public readonly theme$ = this.cdsThemeService.currentTheme$.pipe(
    map((theme: CurrentCarbonTheme) =>
      theme === CurrentCarbonTheme.G10 ? CARBON_THEME.WHITE : CARBON_THEME.G90
    )
  );

  public readonly $defaultComponentValues = signal<Array<MultiInputKeyValue>>([]);

  private readonly _$selectedCustomComponentKey = signal<string | null>(null);
  private readonly _customWidgetConfig$ = new BehaviorSubject<CustomWidgetConfig>({});

  public readonly componentListItems$: Observable<ListItem[]> = combineLatest([
    this._customWidgetConfig$,
    toObservable(this._$selectedCustomComponentKey),
  ]).pipe(
    filter(([config]) => !!config),
    map(([config, selectedKey]) =>
      Object.keys(config).reduce(
        (acc, curr) => [...acc, {content: curr, selected: curr === selectedKey}],
        [] as ListItem[]
      )
    )
  );

  private readonly _subscriptions = new Subscription();
  private readonly _$componentValueValid = signal<boolean>(false);

  constructor(
    @Optional()
    @Inject(CUSTOM_WIDGET_TOKEN)
    private readonly customWidgetConfig: CustomWidgetConfig,
    private readonly cdsThemeService: CdsThemeService,
    private readonly fb: FormBuilder,
    private readonly widgetWizardService: WidgetWizardService
  ) {
    if (customWidgetConfig) this._customWidgetConfig$.next(customWidgetConfig);

    effect(() =>
      this.widgetWizardService.$widgetContentValid.set(
        !!this._$selectedCustomComponentKey() && this._$componentValueValid()
      )
    );
  }

  public componentDropDownChange(event: {
    item: {content: string; selected: boolean};
    isUpdate: boolean;
  }): void {
    const componentKey = event?.item?.content;

    if (!componentKey) return;

    this._$selectedCustomComponentKey.set(componentKey);
    this.widgetWizardService.$widgetContent.update((content: WidgetContentProperties | null) =>
      !content
        ? {componentKey, componentValue: {}}
        : {
            ...content,
            componentKey,
          }
    );
  }

  public ngOnInit(): void {
    this.openTitleSubscription();
    this.openIconSubscription();
    this.prefill();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onKeyValueChange(changeEvent: Array<MultiInputKeyValue>): void {
    this.widgetWizardService.$widgetContent.update((content: WidgetContentProperties | null) => {
      this._$componentValueValid.set(
        !changeEvent.some(value => !value.key || !value.value) || changeEvent.length === 0
      );
      const componentValue = changeEvent.reduce(
        (acc, curr) => ({
          ...acc,
          ...(!curr.key || !curr.value ? {} : {[curr.key]: curr.value}),
        }),
        {} as {[key: string]: string}
      );
      if (!content) return {componentKey: '', componentValue};
      return {...content, componentValue};
    });
  }

  private openTitleSubscription(): void {
    this._subscriptions.add(
      this.widgetTitle?.valueChanges.subscribe(title => {
        this.widgetWizardService.$widgetTitle.set(title);
      })
    );
  }

  private openIconSubscription(): void {
    this._subscriptions.add(
      this.widgetIcon?.valueChanges.subscribe(icon => {
        this.widgetWizardService.$widgetIcon.set(icon);
      })
    );
  }

  private prefill(): void {
    const {componentKey, componentValue} =
      this.widgetWizardService.$widgetContent() as WidgetCustomContent;

    if (
      (!componentKey && !componentValue) ||
      Object.keys(this.customWidgetConfig || {}).length === 0
    )
      return;

    this._$selectedCustomComponentKey.set(componentKey);
    this.$defaultComponentValues.set(
      Object.entries(componentValue).map(([key, value]) => ({key, value}))
    );
    this.widgetWizardService.$widgetContentValid.set(true);
  }
}
