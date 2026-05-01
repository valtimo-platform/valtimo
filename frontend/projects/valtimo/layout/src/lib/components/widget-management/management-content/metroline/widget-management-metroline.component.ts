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
import {Component, HostBinding, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
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
import {WIDGET_CONTENT_METROLINE_TEST_IDS} from '../../../../constants';
import {MetrolineMode, MetrolineOrientation, WidgetMetrolineContent} from '../../../../models';
import {MetrolineWidgetApiService, WidgetWizardService} from '../../../../services';

const KNOWN_MODES: MetrolineMode[] = [
  MetrolineMode.INTERNAL_CASE_STATUS,
  MetrolineMode.ZAAKSTATUS,
];

const MODE_TRANSLATION_KEYS: Record<MetrolineMode, string> = {
  [MetrolineMode.INTERNAL_CASE_STATUS]:
    'widgetTabManagement.content.metroline.statusSource.internalStatus',
  [MetrolineMode.ZAAKSTATUS]: 'widgetTabManagement.content.metroline.statusSource.zaakStatus',
};

@Component({
  templateUrl: './widget-management-metroline.component.html',
  styleUrl: './widget-management-metroline.component.scss',
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    DropdownModule,
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

  public readonly form = this.fb.group({
    widgetTitle: this.fb.control(this.widgetWizardService.$widgetTitle(), Validators.required),
    widgetIcon: this.fb.control(this.widgetWizardService.$widgetIcon()),
    orientation: this.fb.control<MetrolineOrientation>(
      (this.widgetWizardService.$widgetContent() as WidgetMetrolineContent | null)?.orientation ??
        MetrolineOrientation.HORIZONTAL,
      Validators.required
    ),
    mode: this.fb.control<MetrolineMode | null>(
      this.widgetWizardService.$editMode()
        ? (this.widgetWizardService.$widgetContent() as WidgetMetrolineContent | null)?.mode ?? null
        : null,
      Validators.required
    ),
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

  private syncWizardServiceFromForm(): void {
    const value = this.form.getRawValue();
    this.widgetWizardService.$widgetTitle.set(value.widgetTitle ?? '');
    this.widgetWizardService.$widgetIcon.set(value.widgetIcon ?? '');
    this.widgetWizardService.$widgetContent.set({
      orientation: value.orientation!,
      mode: value.mode!,
    });
  }

  private buildModeItems(availableModes: MetrolineMode[]): ListItem[] {
    const current = this.form.get('mode')?.value;
    const visible = new Set<MetrolineMode>(availableModes);
    if (current) visible.add(current);

    return KNOWN_MODES.filter(mode => visible.has(mode)).map(mode => ({
      content: this.translateService.instant(MODE_TRANSLATION_KEYS[mode]),
      id: mode,
      selected: current === mode,
    }));
  }
}
