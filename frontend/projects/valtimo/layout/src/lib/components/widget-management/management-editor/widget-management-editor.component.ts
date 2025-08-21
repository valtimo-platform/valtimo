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
import {ChangeDetectionStrategy, Component, Inject, Input, signal} from '@angular/core';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ActionItem,
  CarbonListItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  ViewType,
} from '@valtimo/components';
import {ButtonModule, IconModule, TabsModule} from 'carbon-components-angular';
import {cloneDeep} from 'lodash';
import {BehaviorSubject, combineLatest, filter, map, Observable, switchMap, take, tap} from 'rxjs';
import {WIDGET_MANAGEMENT_SERVICE} from '../../../constants';
import {IWidgetManagementService} from '../../../interfaces';
import {
  AVAILABLE_WIDGETS,
  BasicWidget,
  Widget,
  WidgetStyle,
  WidgetType,
  WidgetTypeTags,
  WidgetWizardCloseEvent,
  WidgetWizardCloseEventType,
} from '../../../models';
import {WidgetWizardService} from '../../../services';
import {WidgetManagementWizardComponent} from '../management-wizard/widget-management-wizard.component';

@Component({
  selector: 'valtimo-widget-management-editor',
  templateUrl: './widget-management-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    CarbonListModule,
    ButtonModule,
    IconModule,
    TabsModule,
    WidgetManagementWizardComponent,
    ConfirmationModalModule,
  ],
})
export class WidgetManagementEditorComponent {
  @Input() public set params(value: any) {
    if (!value) return;
    this.widgetManagementService.initParams(value);
  }
  @Input() public set availableWidgetTypes(value: WidgetType[]) {
    if (!value) return;

    this.widgetWizardService.$availableWidgetTypes.set(value);
  }

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
      label: 'interface.duplicate',
      callback: this.duplicateWidget.bind(this),
    },
    {
      label: 'interface.delete',
      callback: this.deleteWidget.bind(this),
      type: 'danger',
    },
  ];

  private readonly _refresh$ = new BehaviorSubject<null>(null);
  public readonly widgets$: Observable<CarbonListItem[]> = this._refresh$.pipe(
    switchMap(() =>
      combineLatest([
        this.widgetManagementService.getWidgetConfiguration(),
        this.translateService.stream('key'),
      ])
    ),
    filter(([widgets]) => !!widgets),
    tap(([widgets]) =>
      this.widgetWizardService.$usedWidgetKeys.set(widgets.map((widget: BasicWidget) => widget.key))
    ),
    map(([widgets]) =>
      widgets.map(item => ({
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

  public readonly $isWizardOpen = signal<boolean>(false);
  public readonly $isEditMode = this.widgetWizardService.$editMode;
  public readonly deleteModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly $deleteWidget = signal<BasicWidget | null>(null);

  public readonly $dragAndDropDisabled = signal(false);

  constructor(
    private readonly translateService: TranslateService,
    private readonly widgetWizardService: WidgetWizardService,
    @Inject(WIDGET_MANAGEMENT_SERVICE)
    private widgetManagementService: IWidgetManagementService<any>
  ) {}

  public editWidget(tabWidget: Widget): void {
    this.widgetWizardService.$widgetTitle.set(tabWidget.title);
    this.widgetWizardService.$widgetStyle.set(
      tabWidget.highContrast ? WidgetStyle.HIGH_CONTRAST : WidgetStyle.DEFAULT
    );
    this.widgetWizardService.$widgetWidth.set(tabWidget.width);
    this.widgetWizardService.$selectedWidget.set(
      AVAILABLE_WIDGETS.find(available => available.type === tabWidget.type) ?? null
    );
    this.widgetWizardService.$widgetContent.set(tabWidget.properties);
    this.widgetWizardService.$editMode.set(true);
    this.widgetWizardService.$widgetKey.set(tabWidget.key);
    this.widgetWizardService.$widgetActions.set(tabWidget.actions);
    this.$isWizardOpen.set(true);
  }

  public duplicateWidget(tabWidget: Widget): void {
    const tabWidgetClone = cloneDeep(tabWidget);
    tabWidgetClone.key = '';
    this.editWidget(tabWidgetClone);
  }

  public openAddModal(): void {
    this.$isWizardOpen.set(true);
  }

  public onDeleteConfirm(widget: BasicWidget): void {
    this.widgetManagementService
      .deleteWidget?.(widget)
      .pipe(take(1))
      .subscribe(() => this._refresh$.next(null));
  }

  public onCloseEvent(event: WidgetWizardCloseEvent): void {
    this.$isWizardOpen.set(false);
    this.widgetWizardService.resetWizard();
    const {type, widget} = event;

    if (!widget || type === WidgetWizardCloseEventType.CANCEL) return;

    (type === WidgetWizardCloseEventType.CREATE
      ? this.widgetManagementService.createWidget(widget)
      : this.widgetManagementService.updateWidget(widget)
    )
      .pipe(take(1))
      .subscribe(() => {
        this._refresh$.next(null);
      });
  }

  public onItemsReordered(widgets: Widget[]): void {
    this.$dragAndDropDisabled.set(true);
    this.widgetManagementService
      .updateWidgetConfiguration(widgets)
      .pipe(take(1))
      .subscribe(() => this.$dragAndDropDisabled.set(false));
  }

  private deleteWidget(tabWidget: BasicWidget): void {
    this.$deleteWidget.set(tabWidget);
    this.deleteModalOpen$.next(true);
  }

  private getWidthTranslationKey(width: number): string {
    switch (width) {
      case 1:
        return 'widgetTabManagement.width.small.title';
      case 2:
        return 'widgetTabManagement.width.medium.title';
      case 3:
        return 'widgetTabManagement.width.large.title';
      case 4:
        return 'widgetTabManagement.width.xtraLarge.title';
      default:
        return '-';
    }
  }
}
