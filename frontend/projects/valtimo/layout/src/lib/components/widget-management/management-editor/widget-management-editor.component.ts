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
import {ChangeDetectionStrategy, Component, Inject, Input, OnDestroy, signal} from '@angular/core';
import {toObservable} from '@angular/core/rxjs-interop';
import {DragVertical16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ActionItem,
  CarbonListItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  ViewType,
} from '@valtimo/components';
import {ModalMode} from '@valtimo/shared';
import {ButtonModule, IconModule, IconService, TabsModule} from 'carbon-components-angular';
import {cloneDeep} from 'lodash';
import {BehaviorSubject, combineLatest, filter, map, Observable, switchMap, take, tap} from 'rxjs';

import {WIDGET_MANAGEMENT_SERVICE} from '../../../constants';
import {IWidgetManagementService} from '../../../interfaces';
import {
  AVAILABLE_WIDGETS,
  BasicWidget,
  WIDGET_COLOR_LABELS,
  Widget,
  WidgetColor,
  WidgetDensity,
  WidgetStyle,
  WidgetType,
  WidgetTypeTags,
  WidgetWidth,
  WidgetWizardCloseEvent,
  WidgetWizardCloseEventType,
  WidgetWizardStep,
} from '../../../models';
import {WidgetWizardService} from '../../../services';
import {WidgetManagementDividerModalComponent} from '../management-divider-modal/widget-management-divider-modal.component';
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
    WidgetManagementDividerModalComponent,
  ],
})
export class WidgetManagementEditorComponent implements OnDestroy {
  @Input() public enableWidgetDivider = true;
  @Input() public set params(value: any) {
    if (!value) return;
    this.widgetManagementService.initParams(value);
  }
  @Input() public set availableWidgetTypes(value: WidgetType[]) {
    if (!value) return;
    this.widgetWizardService.$availableWidgetTypes.set(value);
  }

  public readonly disableDuplicate$ = new BehaviorSubject<boolean>(false);
  @Input() public set disableDuplicate(value: boolean) {
    this.disableDuplicate$.next(value);
  }

  public readonly singleWidget$ = new BehaviorSubject<boolean>(false);
  @Input() public set singleWidget(value: boolean) {
    this.singleWidget$.next(value);
  }

  @Input() public set defaultWidth(value: WidgetWidth | undefined) {
    this.widgetWizardService.setDefaultWidth(value ?? null);
  }

  public readonly fields$: Observable<ColumnConfig[]> = combineLatest([
    this.singleWidget$,
    toObservable(this.widgetWizardService.$disableTitleInput),
  ]).pipe(
    map(([singleWidget, disableTitleInput]) => [
      ...(!disableTitleInput
        ? [
            {
              key: 'title',
              label: 'interface.title',
              viewType: ViewType.TEXT,
            },
          ]
        : []),
      {
        key: 'tags',
        label: 'widgetTabManagement.columns.type',
        viewType: ViewType.TAGS,
      },
      ...(!singleWidget
        ? [
            {
              key: 'key',
              label: 'interface.key',
              viewType: ViewType.TEXT,
            },
          ]
        : []),
      ...(this.widgetWizardService.$widgetWizardSteps().includes(WidgetWizardStep.WIDTH)
        ? [
            {
              key: 'widthTranslation',
              label: 'widgetTabManagement.columns.width',
              viewType: ViewType.TEXT,
            },
          ]
        : []),
      ...(this.widgetWizardService.$widgetWizardSteps().includes(WidgetWizardStep.APPEARANCE)
        ? [
            {
              key: 'colorLabel',
              label: 'widgetTabManagement.columns.color',
              viewType: ViewType.TEXT,
            },
          ]
        : []),
      ...(!singleWidget
        ? [
            {
              key: 'densityTranslation',
              label: 'widgetTabManagement.columns.density',
              ViewType: ViewType.BOOLEAN,
            },
          ]
        : []),
      {
        key: 'highContrast',
        label: 'widgetTabManagement.columns.highContrast',
        viewType: ViewType.BOOLEAN,
      },
    ])
  );

  public readonly actionItems$: Observable<ActionItem[]> = this.disableDuplicate$.pipe(
    map(disableDuplicate => [
      {
        label: 'interface.edit',
        callback: this.editWidget.bind(this),
      },
      ...(disableDuplicate
        ? []
        : [
            {
              label: 'interface.duplicate',
              callback: this.duplicateWidget.bind(this),
            },
          ]),
      {
        label: 'interface.delete',
        callback: this.deleteWidget.bind(this),
        type: 'danger',
      },
    ])
  );

  public readonly loading$ = new BehaviorSubject<boolean>(true);

  private readonly _refresh$ = new BehaviorSubject<null>(null);
  public readonly widgets$: Observable<CarbonListItem[]> = this._refresh$.pipe(
    tap(() => this.loading$.next(true)),
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
        densityTranslation: this.translateService.instant(
          `widgetTabManagement.density.${item.isCompact ? 'compact' : 'default'}.title`
        ),
        colorLabel: this.getWidgetColorLabel(item),
        tags: [
          {
            content: this.translateService.instant(`widgetTabManagement.type.${item.type}.title`),
            type: WidgetTypeTags[item.type],
          },
        ],
      }))
    ),
    tap(() => this.loading$.next(false))
  );
  public readonly usedKeys$ = this.widgets$.pipe(
    map((widgets: CarbonListItem[]) => widgets.map((widget: CarbonListItem) => widget.key))
  );
  public readonly dividerDefinition$ = new BehaviorSubject<Widget | null>(null);

  public readonly $isWizardOpen = signal<boolean>(false);
  public readonly $isEditMode = this.widgetWizardService.$editMode;
  public readonly deleteModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly $deleteWidget = signal<BasicWidget | null>(null);

  public readonly $isDividerModalOpen = signal<boolean>(false);
  public readonly $dividerModalMode = signal<ModalMode>('add');
  public readonly $dragAndDropDisabled = signal(false);
  private readonly _colorSupportedWidgetTypes: WidgetType[] = [
    WidgetType.FIELDS,
    WidgetType.COLLECTION,
    WidgetType.TABLE,
  ];

  constructor(
    private readonly iconService: IconService,
    private readonly translateService: TranslateService,
    private readonly widgetWizardService: WidgetWizardService,
    @Inject(WIDGET_MANAGEMENT_SERVICE)
    private widgetManagementService: IWidgetManagementService<any>
  ) {
    this.iconService.registerAll([DragVertical16]);
  }

  public ngOnDestroy(): void {
    this.widgetWizardService.resetWizardSteps();
  }

  public editWidget(widget: Widget): void {
    if (widget.type === WidgetType.DIVIDER) {
      this.dividerDefinition$.next(widget);
      this.$dividerModalMode.set('edit');
      this.$isDividerModalOpen.set(true);
      return;
    }
    this.widgetWizardService.$widgetTitle.set(widget.title);
    this.widgetWizardService.$widgetIcon.set(widget.icon ?? null);
    this.widgetWizardService.$widgetStyle.set(
      widget.highContrast ? WidgetStyle.HIGH_CONTRAST : WidgetStyle.DEFAULT
    );
    this.widgetWizardService.$widgetColor.set(widget.color ?? WidgetColor.WHITE);
    this.widgetWizardService.$widgetWidth.set(
      widget.width || this.widgetWizardService.defaultWidth
    );
    this.widgetWizardService.$selectedWidget.set(
      AVAILABLE_WIDGETS.find(available => available.type === widget.type) ?? null
    );
    this.widgetWizardService.$widgetDensity.set(
      !!widget.isCompact ? WidgetDensity.COMPACT : WidgetDensity.DEFAULT
    );
    this.widgetWizardService.$widgetContent.set(widget.properties ?? null);
    this.widgetWizardService.$widgetDisplayConditions.set(widget.displayConditions);
    this.widgetWizardService.$editMode.set(true);
    this.widgetWizardService.$widgetKey.set(widget.key);
    this.widgetWizardService.$widgetActions.set(widget.actions);
    this.$isWizardOpen.set(true);
  }

  private getWidgetColorLabel(widget: BasicWidget): string {
    const color =
      this.widgetSupportsColor(widget.type) && widget.color
        ? widget.color
        : WidgetColor.WHITE;

    return this.translateService.instant(
      WIDGET_COLOR_LABELS[color] ??
      'widgetTabManagement.appearance.backgroundColor.colors.white'
    );
  }

  private widgetSupportsColor(type: WidgetType): boolean {
    return this._colorSupportedWidgetTypes.includes(type);
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

  public onCloseEvent(event: WidgetWizardCloseEvent | null): void {
    this.$isWizardOpen.set(false);
    this.dividerDefinition$.next(null);
    this.$dividerModalMode.set('add');
    this.$isDividerModalOpen.set(false);
    this.widgetWizardService.resetWizard();

    if (!event) return;

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
      .subscribe(() => {
        this.$dragAndDropDisabled.set(false);
        this._refresh$.next(null);
      });
  }

  public openAddDividerModal(): void {
    this.$isDividerModalOpen.set(true);
  }

  public onCloseDividerModalEvent(dividerDefinition: BasicWidget): void {
    if (!dividerDefinition) return;

    (this.$dividerModalMode() === 'add'
      ? this.widgetManagementService.createWidget(dividerDefinition)
      : this.widgetManagementService.updateWidget(dividerDefinition)
    )
      .pipe(take(1))
      .subscribe(() => this._refresh$.next(null));
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
