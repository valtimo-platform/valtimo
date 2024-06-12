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
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {
  ActionItem,
  CarbonListItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  ViewType,
} from '@valtimo/components';
import {BasicCaseWidget, CaseWidget, CaseWidgetType, CaseWidgetsRes} from '@valtimo/dossier';
import {ButtonModule, IconModule, TabsModule} from 'carbon-components-angular';
import {BehaviorSubject, Subject, take} from 'rxjs';
import {AVAILABLE_WIDGETS, WidgetStyle} from '../../../models';
import {WidgetTabManagementService, WidgetWizardService} from '../../../services';
import {DossierManagementWidgetWizardComponent} from '../../dossier-management-widget-wizard/dossier-management-widget-wizard.component';

@Component({
  selector: 'valtimo-dossier-management-widgets-editor',
  templateUrl: './dossier-management-widgets-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    CarbonListModule,
    ButtonModule,
    IconModule,
    TabsModule,
    DossierManagementWidgetWizardComponent,
    ConfirmationModalModule,
  ],
})
export class DossierManagementWidgetsEditorComponent {
  @Input() public documentDefinitionName: string;
  @Input() public tabWidgetKey: string;
  private _currentWidgetTab: CaseWidgetsRes;
  @Input() public set currentWidgetTab(value: CaseWidgetsRes) {
    this._currentWidgetTab = value;
    this.items$.next(value?.widgets);
    this._usedKeys = value?.widgets.map(widget => widget.key);
  }
  public get currentWidgetTab(): CaseWidgetsRes {
    return this._currentWidgetTab;
  }

  @Output() public readonly changeSaved = new EventEmitter();

  public readonly FIELDS: ColumnConfig[] = [
    {
      key: 'key',
      label: 'interface.key',
      viewType: ViewType.TEXT,
    },
    {
      key: 'title',
      label: 'interface.title',
      viewType: ViewType.TEXT,
    },
  ];

  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      label: 'interface.edit',
      callback: this.editWidget.bind(this),
      disabledCallback: this.disableEdit.bind(this),
    },
    {
      label: 'interface.delete',
      callback: this.deleteWidget.bind(this),
      type: 'danger',
    },
  ];

  public readonly items$ = new BehaviorSubject<CarbonListItem[]>([]);

  public readonly isWizardOpen$ = new BehaviorSubject<boolean>(false);
  public readonly isEditMode = this.widgetWizardService.editMode;
  public readonly deleteModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly deleteRowKey$ = new Subject<number>();

  private _usedKeys: string[];

  constructor(
    private readonly widgetTabManagementService: WidgetTabManagementService,
    private readonly widgetWizardService: WidgetWizardService
  ) {}

  public openAddModal(): void {
    this.isWizardOpen$.next(true);
  }

  private editWidget(tabWidget: CaseWidget): void {
    this.widgetWizardService.widgetTitle.set(tabWidget.title);
    this.widgetWizardService.widgetStyle.set(
      tabWidget.highContrast ? WidgetStyle.HIGH_CONTRAST : WidgetStyle.DEFAULT
    );
    this.widgetWizardService.widgetWidth.set(tabWidget.width);
    this.widgetWizardService.selectedWidget.set(
      AVAILABLE_WIDGETS.find(available => available.type === tabWidget.type) ?? null
    );
    this.widgetWizardService.widgetContent.set(tabWidget.properties);
    this.widgetWizardService.editMode.set(true);
    this.widgetWizardService.widgetKey.set(tabWidget.key);
    this.isWizardOpen$.next(true);
  }

  public onDeleteConfirm(widgetKey: string): void {
    this.widgetTabManagementService
      .updateWidgets({
        ...this.currentWidgetTab,
        widgets: this.currentWidgetTab.widgets.filter(widget => widget.key !== widgetKey),
      })
      .pipe(take(1))
      .subscribe(() => {
        this.changeSaved.emit();
      });
  }

  private deleteWidget(tabWidget: any): void {
    this.deleteRowKey$.next(tabWidget.key);
    this.deleteModalOpen$.next(true);
  }

  public onCloseEvent(widgetResult: BasicCaseWidget, existingWidgets: CaseWidget[]): void {
    this.isWizardOpen$.next(false);
    this.widgetWizardService.resetWizard();

    if (!widgetResult) return;

    this.widgetTabManagementService
      .updateWidgets({
        caseDefinitionName: this.documentDefinitionName,
        key: this.tabWidgetKey,
        widgets: !!widgetResult.key
          ? existingWidgets.map((widget: BasicCaseWidget) =>
              widget.key === widgetResult.key ? widgetResult : widget
            )
          : [...existingWidgets, {...widgetResult, key: this.getUniqueKey(widgetResult.title)}],
      })
      .pipe(take(1))
      .subscribe(() => {
        this.changeSaved.emit();
      });
  }

  public onItemsReordered(widgets: CaseWidget[]): void {
    this.widgetTabManagementService
      .updateWidgets({
        ...this.currentWidgetTab,
        widgets,
      })
      .pipe(take(1))
      .subscribe(() => {
        this.changeSaved.emit();
      });
  }

  private disableEdit(widget: BasicCaseWidget): boolean {
    return widget.type === CaseWidgetType.TABLE;
  }

  private getUniqueKey(widgetName: string): string {
    const dashCaseKey = `${widgetName}`
      .toLowerCase()
      .replace(/[^a-z0-9-_]+|-[^a-z0-9]+/g, '-')
      .replace(/_[-_]+/g, '_')
      .replace(/^[^a-z]+/g, '');
    const usedKeys = this._usedKeys;

    if (!usedKeys.includes(dashCaseKey)) {
      return dashCaseKey;
    }

    return this.getUniqueKeyWithNumber(dashCaseKey, usedKeys);
  }

  private getUniqueKeyWithNumber(dashCaseKey: string, usedKeys: string[]): string {
    const numbersFromCurrentKey = (dashCaseKey.match(/^\d+|\d+\b|\d+(?=\w)/g) || []).map(
      (numberValue: string) => +numberValue
    );
    const lastNumberFromCurrentKey =
      numbersFromCurrentKey.length > 0 && numbersFromCurrentKey[numbersFromCurrentKey.length - 1];
    const newKey = lastNumberFromCurrentKey
      ? `${dashCaseKey.replace(`${lastNumberFromCurrentKey}`, `${lastNumberFromCurrentKey + 1}`)}`
      : `${dashCaseKey}-1`;

    if (usedKeys.includes(newKey)) {
      return this.getUniqueKeyWithNumber(newKey, usedKeys);
    }

    return newKey;
  }
}
