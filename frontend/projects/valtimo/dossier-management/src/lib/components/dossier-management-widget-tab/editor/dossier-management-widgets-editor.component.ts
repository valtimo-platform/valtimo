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
  Input,
  Output,
  signal,
} from '@angular/core';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ActionItem,
  CarbonListItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  KeyGeneratorService,
  ViewType,
} from '@valtimo/components';
import {BasicCaseWidget, CaseWidget, CaseWidgetsRes} from '@valtimo/dossier';
import {ButtonModule, IconModule, TabsModule} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable, Subject, take} from 'rxjs';
import {AVAILABLE_WIDGETS, WidgetStyle, WidgetTypeTags} from '../../../models';
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
    if (!value) return;

    this._currentWidgetTab = value;
    this._items$.next(value?.widgets);
    this._usedKeys = value?.widgets.map(widget => widget.key);
    this.dragAndDropDisabled.set(false);
  }
  public get currentWidgetTab(): CaseWidgetsRes {
    return this._currentWidgetTab;
  }

  @Output() public readonly changeSaved = new EventEmitter();

  public readonly FIELDS: ColumnConfig[] = [
    {
      key: 'title',
      label: 'interface.title',
      viewType: ViewType.TEXT,
    },
    {
      key: 'tags',
      label: 'widgetTabManagement.columns.type',
      viewType: ViewType.TAGS,
    },
    {
      key: 'key',
      label: 'interface.key',
      viewType: ViewType.TEXT,
    },
    {
      key: 'widthTranslation',
      label: 'widgetTabManagement.columns.width',
      viewType: ViewType.TEXT,
    },
    {
      key: 'highContrast',
      label: 'widgetTabManagement.columns.highContrast',
      viewType: ViewType.BOOLEAN,
    },
  ];

  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      label: 'interface.edit',
      callback: this.editWidget.bind(this),
    },
    {
      label: 'interface.delete',
      callback: this.deleteWidget.bind(this),
      type: 'danger',
    },
  ];

  private readonly _items$ = new BehaviorSubject<CarbonListItem[]>([]);
  public readonly items$: Observable<CarbonListItem[]> = combineLatest([
    this._items$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([items]) =>
      items.map(item => ({
        ...item,
        widthTranslation: this.translateService.instant(this.getWidthTranslationKey(item.width)),
        tags: [
          {
            content: this.translateService.instant(`widgetTabManagement.types.${item.type}.title`),
            type: WidgetTypeTags[item.type],
          },
        ],
      }))
    )
  );

  public readonly isWizardOpen$ = new BehaviorSubject<boolean>(false);
  public readonly isEditMode = this.widgetWizardService.editMode;
  public readonly deleteModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly deleteRowKey$ = new Subject<number>();

  public readonly dragAndDropDisabled = signal(false);

  private _usedKeys: string[];

  constructor(
    private readonly keyGeneratorService: KeyGeneratorService,
    private readonly translateService: TranslateService,
    private readonly widgetTabManagementService: WidgetTabManagementService,
    private readonly widgetWizardService: WidgetWizardService
  ) {}

  public editWidget(tabWidget: CaseWidget): void {
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

  public openAddModal(): void {
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
          : [
              ...existingWidgets,
              {
                ...widgetResult,
                key: this.keyGeneratorService.getUniqueKey(widgetResult.title, this._usedKeys),
              },
            ],
      })
      .pipe(take(1))
      .subscribe(() => {
        this.changeSaved.emit();
      });
  }

  public onItemsReordered(widgets: CaseWidget[]): void {
    this.dragAndDropDisabled.set(true);

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

  private deleteWidget(tabWidget: any): void {
    this.deleteRowKey$.next(tabWidget.key);
    this.deleteModalOpen$.next(true);
  }

  private getWidthTranslationKey(width: number): string {
    switch (width) {
      case 1:
        return 'widgetTabManagement.width.quarter.title';
      case 2:
        return 'widgetTabManagement.width.half.title';
      case 3:
        return 'widgetTabManagement.width.threeQuarters.title';
      case 4:
        return 'widgetTabManagement.width.fullWidth.title';
      default:
        return '-';
    }
  }
}
