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
import {ChangeDetectionStrategy, Component, Inject, OnInit} from '@angular/core';
import {AbstractControl, FormBuilder, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {CARBON_THEME, CdsThemeService, CurrentCarbonTheme} from '@valtimo/components';
import {DocumentService, ProcessDefinitionCaseDefinition} from '@valtimo/document';
import {CaseManagementParams} from '@valtimo/shared';
import {ComboBoxModule, InputModule, LayerModule, ListItem} from 'carbon-components-angular';
import {debounceTime, map, Observable, Subscription, switchMap} from 'rxjs';
import {WIDGET_MANAGEMENT_SERVICE} from '../../../constants';
import {IWidgetManagementService} from '../../../interfaces';
import {WidgetWizardService} from '../../../services';

@Component({
  selector: 'valtimo-widget-management-process-selector',
  templateUrl: './widget-management-process-selector.component.html',
  styleUrl: './widget-management-process-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    InputModule,
    ReactiveFormsModule,
    ComboBoxModule,
    LayerModule,
  ],
})
export class WidgetManagementProcessSelectorComponent implements OnInit {
  public readonly formGroup = this.fb.group({
    name: this.fb.control<string>({
      value: this.widgetWizardService.$widgetActions()?.[0]?.name ?? '',
      disabled: !this.widgetWizardService.$widgetActions()?.length,
    }),
    processDefinition: this.fb.control<ListItem>({
      content: '',
      key: this.widgetWizardService.$widgetActions()?.[0]?.processDefinitionKey,
      selected: false,
    }),
  });

  public readonly processDefinitionItems$: Observable<ListItem[]> =
    this.widgetManagementService.params$.pipe(
      switchMap((params: CaseManagementParams | null) =>
        this.documentService.findProcessDefinitionCaseDefinitionsByStartableByUser(
          params?.caseDefinitionKey ?? '',
          true
        )
      ),
      map((processDocumentDefinitions: ProcessDefinitionCaseDefinition[]) => {
        const selectedProcessKey: string | undefined = this.widgetWizardService.$editMode()
          ? this.widgetWizardService.$widgetActions()?.[0]?.processDefinitionKey
          : undefined;

        return processDocumentDefinitions.map((definition: ProcessDefinitionCaseDefinition) => {
          const mappedItem: ListItem = {
            content: definition.processDefinitionName,
            key: definition.processDefinitionKey,
            selected: selectedProcessKey === definition.processDefinitionKey,
          };

          if (mappedItem.selected)
            this.formGroup.patchValue({processDefinition: mappedItem}, {emitEvent: false});

          return mappedItem;
        });
      })
    );

  public readonly theme$ = this.cdsThemeService.currentTheme$.pipe(
    map((theme: CurrentCarbonTheme) =>
      theme === CurrentCarbonTheme.G10 ? CARBON_THEME.WHITE : CARBON_THEME.G90
    )
  );

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly cdsThemeService: CdsThemeService,
    private readonly documentService: DocumentService,
    private readonly fb: FormBuilder,
    private readonly widgetWizardService: WidgetWizardService,
    @Inject(WIDGET_MANAGEMENT_SERVICE)
    private widgetManagementService: IWidgetManagementService<any>
  ) {}
  public ngOnInit(): void {
    this._subscriptions.add(
      this.formGroup.valueChanges
        .pipe(debounceTime(100))
        .subscribe(
          (changes: Partial<{name: string | null; processDefinition: ListItem | null}>) => {
            const {name, processDefinition} = changes;
            this.widgetWizardService.$widgetActions.set([
              {
                name: !name ? processDefinition?.content : name,
                processDefinitionKey: processDefinition?.key,
              },
            ]);
          }
        )
    );
  }

  public onProcessSelected(selection: ListItem | Array<object>): void {
    const nameFormControl: AbstractControl | null = this.formGroup.get('name');
    if (!nameFormControl) return;

    if (Array.isArray(selection) && selection.length === 0) nameFormControl.disable();
    else nameFormControl.enable();
  }
}
