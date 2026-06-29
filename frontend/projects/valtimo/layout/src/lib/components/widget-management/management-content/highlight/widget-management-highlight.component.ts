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
  computed,
  HostBinding,
  Inject,
  OnDestroy,
  OnInit,
  Signal,
  ViewEncapsulation,
} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  CdsThemeService,
  CurrentCarbonTheme,
  InputLabelModule,
  MdiIconSelectorComponent,
  ValuePathSelectorComponent, ValuePathSelectorPrefix,
} from '@valtimo/components';
import {
  ButtonModule,
  DropdownModule,
  IconModule,
  InputModule,
  LayerModule,
  ListItem,
  TagModule,
} from 'carbon-components-angular';
import {debounceTime, map, Subscription} from 'rxjs';
import {
  HighlightDisplayType,
  WidgetColor,
  WidgetColorTile,
  WidgetHighlightContent,
} from '../../../../models';
import {
  WIDGET_COLOR_ITEMS,
  WIDGET_COLOR_THEME_MAP,
  WIDGET_COLOR_TO_TAG_TYPE,
  WIDGET_MANAGEMENT_SERVICE,
} from '../../../../constants';
import {IWidgetManagementService} from '../../../../interfaces';
import {WidgetWizardService} from '../../../../services';

@Component({
  templateUrl: './widget-management-highlight.component.html',
  styleUrl: './widget-management-highlight.component.scss',
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
    DropdownModule,
    IconModule,
    ButtonModule,
    TagModule,
    MdiIconSelectorComponent,
    ValuePathSelectorComponent,
  ],
})
export class WidgetManagementHighlightComponent implements OnInit, OnDestroy {
  @HostBinding('class') public readonly class = 'valtimo-widget-management-highlight';

  public readonly form = this.fb.group({
    widgetTitle: this.fb.control(this.widgetWizardService.$widgetTitle(), Validators.required),
    widgetIcon: this.fb.control(this.widgetWizardService.$widgetIcon()),
    value: this.fb.control(
      (this.widgetWizardService.$widgetContent() as WidgetHighlightContent)?.value ?? '',
      Validators.required
    ),
  });

  private readonly $isLightTheme = toSignal(
    this.cdsThemeService.currentTheme$.pipe(
      map(theme => theme === CurrentCarbonTheme.G10 || theme === CurrentCarbonTheme.WHITE)
    ),
    {initialValue: true}
  );

  public readonly $colorItems: Signal<ListItem[]> = computed(() => {
    const selectedColor = this.widgetWizardService.$widgetColor() ?? WidgetColor.WHITE;
    const themeType = this.$isLightTheme() ? 'light' : 'dark';
    return this.colorTiles.map(tile => {
      const variant = WIDGET_COLOR_THEME_MAP[tile.color][themeType];
      const tagType = WIDGET_COLOR_TO_TAG_TYPE[tile.color];
      return {
        content: this.translateService.instant(tile.labelKey),
        key: tile.color,
        selected: tile.color === selectedColor,
        tagType,
        tagBackground: variant.background,
        tagText: variant.text,
      };
    });
  });

  private readonly colorTiles: WidgetColorTile[] = WIDGET_COLOR_ITEMS.map(color => ({
    color,
    labelKey: `widgetTabManagement.appearance.backgroundColor.colors.${
      color === WidgetColor.HIGHCONTRAST ? 'highContrast' : color.toLowerCase()
    }`,
    illustration: '',
  }));

  public readonly $widgetContext = this.widgetWizardService.$widgetContext;
  public readonly params$ = this.widgetManagementService.params$;

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly widgetWizardService: WidgetWizardService,
    private readonly translateService: TranslateService,
    private readonly cdsThemeService: CdsThemeService,
    @Inject(WIDGET_MANAGEMENT_SERVICE)
    private readonly widgetManagementService: IWidgetManagementService<any>
  ) {}

  public ngOnInit(): void {
    if (!this.widgetWizardService.$widgetColor()) {
      this.widgetWizardService.$widgetColor.set(WidgetColor.BLUE);
    }
    this.widgetWizardService.$widgetWidth.set(1);
    this.syncContentValid();

    this._subscriptions.add(
      this.form.valueChanges.pipe(debounceTime(100)).subscribe(formValue => {
        this.widgetWizardService.$widgetTitle.set(formValue.widgetTitle ?? '');
        this.widgetWizardService.$widgetIcon.set(formValue.widgetIcon ?? '');
        this.widgetWizardService.$widgetContent.set({
          value: formValue.value ?? '',
          displayProperties: {type: HighlightDisplayType.NUMBER},
        } as WidgetHighlightContent);
        this.syncContentValid();
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onColorSelected(event: {item: ListItem | undefined}): void {
    const colorKey = event?.item?.key as WidgetColor | undefined;
    if (!colorKey) return;
    this.widgetWizardService.$widgetColor.set(colorKey);
  }

  private syncContentValid(): void {
    this.widgetWizardService.$widgetContentValid.set(this.form.valid);
  }

  protected readonly ValuePathSelectorPrefix = ValuePathSelectorPrefix;
}
