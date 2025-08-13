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
  EventEmitter,
  Inject,
  OnDestroy,
  OnInit,
  Optional,
  Output,
} from '@angular/core';
import {AbstractControl, FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {CARBON_THEME, CdsThemeService, CurrentCarbonTheme} from '@valtimo/components';
import {DropdownModule, InputModule, ListItem, SelectModule} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, filter, map, Observable, Subscription} from 'rxjs';
import {IWidgetContentComponent} from '../../../interfaces';
import {CustomWidgetConfig, WidgetCustomContent} from '../../../models';
import {WidgetWizardService} from '../../../services';
import {CUSTOM_WIDGET_TOKEN} from '../../../constants';

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
  ],
})
export class WidgetManagementCustomComponent implements IWidgetContentComponent, OnDestroy, OnInit {
  @Output() public readonly changeValidEvent = new EventEmitter<boolean>();

  public readonly form = this.fb.group({
    widgetTitle: this.fb.control(this.widgetWizardService.$widgetTitle(), Validators.required),
  });

  public get widgetTitle(): AbstractControl<string | null, string | null> | null {
    return this.form.get('widgetTitle');
  }

  public readonly theme$ = this.cdsThemeService.currentTheme$.pipe(
    map((theme: CurrentCarbonTheme) =>
      theme === CurrentCarbonTheme.G10 ? CARBON_THEME.WHITE : CARBON_THEME.G90
    )
  );

  private readonly _selectedCustomComponentKey$ = new BehaviorSubject<string | null>(null);
  private readonly _customWidgetConfig$ = new BehaviorSubject<CustomWidgetConfig>({});

  public readonly componentListItems$: Observable<ListItem[]> = combineLatest([
    this._customWidgetConfig$,
    this._selectedCustomComponentKey$,
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

  constructor(
    @Optional()
    @Inject(CUSTOM_WIDGET_TOKEN)
    private readonly customWidgetConfig: CustomWidgetConfig,
    private readonly cdsThemeService: CdsThemeService,
    private readonly fb: FormBuilder,
    private readonly widgetWizardService: WidgetWizardService
  ) {
    if (customWidgetConfig) this._customWidgetConfig$.next(customWidgetConfig);
  }

  public componentDropDownChange(event: {
    item: {content: string; selected: boolean};
    isUpdate: boolean;
  }): void {
    const componentKey = event?.item?.content;

    if (!componentKey) return;

    this._selectedCustomComponentKey$.next(componentKey);
    this.widgetWizardService.$widgetContent.set({componentKey});
    this.changeValidEvent.emit(true);
  }

  public ngOnInit(): void {
    this.openTitleSubscription();
    this.prefill();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  private openTitleSubscription(): void {
    this._subscriptions.add(
      this.widgetTitle?.valueChanges.subscribe(title => {
        this.widgetWizardService.$widgetTitle.set(title);
      })
    );
  }

  private prefill(): void {
    const componentKey = (this.widgetWizardService.$widgetContent() as WidgetCustomContent)
      ?.componentKey;

    if (!componentKey || Object.keys(this.customWidgetConfig || {}).length === 0) return;

    this._selectedCustomComponentKey$.next(componentKey);
    this.changeValidEvent.emit(true);
  }
}
