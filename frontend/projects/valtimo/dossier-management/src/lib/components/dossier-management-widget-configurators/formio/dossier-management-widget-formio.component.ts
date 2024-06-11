/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {AbstractControl, FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {CARBON_THEME, CdsThemeService, CurrentCarbonTheme} from '@valtimo/components';
import {WidgetFormioContent} from '@valtimo/dossier';
import {FormDefinitionOption, FormService} from '@valtimo/form';
import {DropdownModule, InputModule, SelectModule} from 'carbon-components-angular';
import {ListItem} from 'carbon-components-angular/dropdown/list-item.interface';
import {BehaviorSubject, combineLatest, filter, map, Observable, Subscription} from 'rxjs';
import {WidgetContentComponent} from '../../../models';
import {WidgetWizardService} from '../../../services';

@Component({
  templateUrl: './dossier-management-widget-formio.component.html',
  styleUrls: ['./dossier-management-widget-formio.component.scss'],
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
export class DossierManagementWidgetFormioComponent
  implements WidgetContentComponent, OnDestroy, OnInit
{
  @Output() public readonly changeValidEvent = new EventEmitter<boolean>();

  public readonly form = this.fb.group({
    widgetTitle: this.fb.control(this.widgetWizardService.widgetTitle(), Validators.required),
  });

  public get widgetTitle(): AbstractControl<string | null> | null {
    return this.form.get('widgetTitle');
  }

  public readonly theme$ = this.cdsThemeService.currentTheme$.pipe(
    map((theme: CurrentCarbonTheme) =>
      theme === CurrentCarbonTheme.G10 ? CARBON_THEME.WHITE : CARBON_THEME.G90
    )
  );

  private readonly _selectedFormDefinitionId$ = new BehaviorSubject<string | null>(null);

  private readonly _formDefinitionOptions$ = new BehaviorSubject<FormDefinitionOption[]>([]);

  public readonly formListItems$: Observable<ListItem[]> = combineLatest([
    this._formDefinitionOptions$,
    this._selectedFormDefinitionId$,
  ]).pipe(
    filter(([options]) => !!options),
    map(([options, selectedFormId]) =>
      options.map(option => ({
        content: option.name,
        id: option.name,
        selected: option.name === selectedFormId,
      }))
    )
  );

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly cdsThemeService: CdsThemeService,
    private readonly fb: FormBuilder,
    private readonly widgetWizardService: WidgetWizardService,
    private readonly formService: FormService
  ) {}

  public componentDropDownChange(event: {
    item: {id: string; selected: boolean};
    isUpdate: boolean;
  }): void {
    const formDefinitionId = event?.item?.id;

    if (!formDefinitionId) return;

    this._selectedFormDefinitionId$.next(formDefinitionId);
    this.widgetWizardService.widgetContent.set({formDefinitionName: formDefinitionId});
    this.changeValidEvent.emit(true);
  }

  public ngOnInit(): void {
    this.fetchFormDefinition();
    this.openTitleSubscription();
    this.prefill();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  private openTitleSubscription(): void {
    this._subscriptions.add(
      this.widgetTitle?.valueChanges.subscribe(title => {
        this.widgetWizardService.widgetTitle.set(title);
      })
    );
  }

  private fetchFormDefinition(): void {
    this.formService.getAllFormDefinitions().subscribe(definitions => {
      this._formDefinitionOptions$.next(definitions);
    });
  }

  private prefill(): void {
    const formDefinitionId = (this.widgetWizardService.widgetContent() as WidgetFormioContent)
      ?.formDefinitionName;

    if (!formDefinitionId) return;

    this._selectedFormDefinitionId$.next(formDefinitionId);
    this.changeValidEvent.emit(true);
  }
}
