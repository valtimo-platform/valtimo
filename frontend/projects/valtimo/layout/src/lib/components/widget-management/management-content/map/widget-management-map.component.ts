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
  HostBinding,
  OnDestroy,
  OnInit,
  signal,
  ViewEncapsulation,
  WritableSignal,
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
import {CdsThemeService, CurrentCarbonTheme, InputLabelModule} from '@valtimo/components';
import {
  AccordionModule,
  ButtonModule,
  IconModule,
  InputModule,
  LayerModule,
  TabsModule,
} from 'carbon-components-angular';
import {debounceTime, Observable, Subscription} from 'rxjs';
import {GeoJsonSource, WidgetMapContent} from '../../../../models';
import {WidgetWizardService} from '../../../../services';
import { TEST_IDS } from '@valtimo/shared';

@Component({
  templateUrl: './widget-management-map.component.html',
  styleUrl: './widget-management-map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    InputModule,
    TabsModule,
    IconModule,
    ReactiveFormsModule,
    ButtonModule,
    InputLabelModule,
    AccordionModule,
    LayerModule,
  ],
})
export class WidgetManagementMapComponent implements OnDestroy, OnInit {
  readonly TEST_IDS = TEST_IDS;

  @HostBinding('class') public readonly class = 'valtimo-widget-management-map';

  public readonly $showTitleInput = signal<boolean>(true);

  public form = this.fb.group({
    widgetTitle: this.fb.control(this.widgetWizardService.$widgetTitle(), Validators.required),
    geoJsonSources: this.fb.array<GeoJsonSource>([]),
  });

  public readonly $widgetContext = this.widgetWizardService.$widgetContext;
  public readonly $content = this.widgetWizardService
    .$widgetContent as WritableSignal<WidgetMapContent>;
  public readonly inputTheme$: Observable<CurrentCarbonTheme> = this.cdsThemeService.currentTheme$;

  private readonly _subscriptions = new Subscription();

  public get formGeoJsonSources(): FormArray | undefined {
    if (!this.form.get('geoJsonSources')) return undefined;

    return this.form.get('geoJsonSources') as FormArray;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly widgetWizardService: WidgetWizardService,
    private readonly cdsThemeService: CdsThemeService
  ) {}

  public ngOnInit(): void {
    this.widgetWizardService.$widgetContentValid.set(false);
    this.initForm();

    this._subscriptions.add(
      this.form.valueChanges.pipe(debounceTime(100)).subscribe(formValue => {
        this.widgetWizardService.$widgetTitle.set(formValue.widgetTitle ?? '');
        this.widgetWizardService.$widgetContentValid.set(this.form.valid);
        this.widgetWizardService.$widgetContent.set({geoJsonSources: formValue.geoJsonSources});
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.form.reset();
    this.widgetWizardService.$widgetContentValid.set(false);
  }

  private initForm(): void {
    if (!this.$content()?.geoJsonSources) {
      this.addField();
      return;
    }

    const sourcesControl = this.form.get('geoJsonSources') as FormArray;
    if (!sourcesControl) return;

    this.$content().geoJsonSources.forEach((geoJsonSource: GeoJsonSource) => {
      sourcesControl.push(this.getGeoJsonSourcesForm(geoJsonSource), {emitEvent: false});
    });
    this.widgetWizardService.$widgetContentValid.set(this.form.valid);
  }

  private getGeoJsonSourcesForm(geoJsonSource: GeoJsonSource): FormGroup {
    return this.fb.group({
      key: this.fb.control<string>(geoJsonSource.key, Validators.required),
    });
  }

  public addField(): void {
    if (!this.formGeoJsonSources) return;

    this.formGeoJsonSources.push(
      this.fb.group({
        key: this.fb.control<string>('', Validators.required),
      })
    );
  }

  public onDeleteRowClick(event: Event, formArray: FormArray, index: number): void {
    event.stopImmediatePropagation();
    if (!formArray) return;

    formArray.removeAt(index);
  }
}
