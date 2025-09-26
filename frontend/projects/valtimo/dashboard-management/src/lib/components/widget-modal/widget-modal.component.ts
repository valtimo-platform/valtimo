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

import {
  Component,
  EventEmitter,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {DashboardItem, WidgetDataSource, WidgetModalType} from '../../models';
import {FormBuilder, Validators} from '@angular/forms';
import {ListItem, NotificationService} from 'carbon-components-angular';
import {TranslateService} from '@ngx-translate/core';
import {DOCUMENT} from '@angular/common';
import {DashboardManagementService} from '../../services/dashboard-management.service';
import {CARBON_CONSTANTS} from '@valtimo/components';
import {
  ConfigurationOutput,
  DashboardWidgetConfiguration,
  DisplayTypeSpecification,
  WidgetService,
  WidgetTranslationService,
} from '@valtimo/dashboard';

@Component({
  selector: 'valtimo-widget-modal',
  templateUrl: './widget-modal.component.html',
  styleUrls: ['./widget-modal.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [NotificationService],
})
export class WidgetModalComponent implements OnInit, OnDestroy {
  @Input() public showModal$: Observable<boolean>;
  @Input() public type: WidgetModalType;
  @Input() public dashboard: DashboardItem;
  @Input() public widgetKey!: string;
  @Input() public set editWidgetConfiguration(configuration: DashboardWidgetConfiguration) {
    if (configuration) {
      this.title.setValue(configuration.title);
      this.dataSourceSelected({item: {key: configuration.dataSourceKey}} as any);
      this.displayTypeSelected({item: {key: configuration.displayType}} as any);
      this.dataSourcePrefillConfig$.next(configuration.dataSourceProperties);
      this.displayTypePrefillConfig$.next(configuration.displayTypeProperties);
    } else {
      this.dataSourcePrefillConfig$.next(null);
      this.displayTypePrefillConfig$.next(null);
    }
  }
  @Output() public saveEvent = new EventEmitter<ConfigurationOutput>();

  public readonly form = this.fb.group({
    title: this.fb.control('', [Validators.required]),
    dataSource: this.fb.control(null, [Validators.required]),
    displayType: this.fb.control(null, [Validators.required]),
  });

  public readonly open$ = new BehaviorSubject<boolean>(false);
  public readonly selectedDataSourceKey$ = new BehaviorSubject<string>('');
  public readonly selectedDisplayTypeKey$ = new BehaviorSubject<string>('');

  public readonly dataSourceItems$: Observable<Array<ListItem>> = combineLatest([
    this.dashboardManagementService.getDataSources(),
    this.selectedDataSourceKey$,
    this.widgetService.supportedDataSources$,
    this.translateService.stream('key'),
  ]).pipe(
    filter(([dataSources]) => !!dataSources),
    tap(([dataSources, selectedDataSourceKey]) => {
      if (selectedDataSourceKey) {
        this.setCompatibleDisplayTypes(dataSources, selectedDataSourceKey);
      } else {
        this.resetCompatibleDisplayTypes();
      }
    }),
    map(([dataSources, selectedDataSourceKey, supportedDataSources]) =>
      dataSources
        .filter(dataSource =>
          supportedDataSources.find(
            supportedDataSource => supportedDataSource.dataSourceKey === dataSource.key
          )
        )
        .map(dataSource => ({
          content: this.widgetTranslationService.instant('title', dataSource.key),
          selected: selectedDataSourceKey === dataSource.key,
          key: dataSource.key,
        }))
    )
  );

  public readonly dataSourcePrefillConfig$ = new BehaviorSubject<object | null>(null);
  public readonly displayTypePrefillConfig$ = new BehaviorSubject<object | null>(null);

  private readonly _compatibleDisplayTypes$ = new BehaviorSubject<Array<DisplayTypeSpecification>>(
    []
  );

  public readonly displayTypeItems$: Observable<Array<ListItem>> = combineLatest([
    this._compatibleDisplayTypes$,
    this.selectedDisplayTypeKey$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([compatibleDisplayTypes, selectedDisplayTypeKey]) =>
      compatibleDisplayTypes.map(displayType => ({
        content: this.widgetTranslationService.instant('title', displayType.displayTypeKey),
        selected: displayType.displayTypeKey === selectedDisplayTypeKey,
        key: displayType.displayTypeKey,
      }))
    )
  );

  public readonly displayTypeDropdownDisabled$: Observable<boolean> = combineLatest([
    this._compatibleDisplayTypes$,
    this.selectedDataSourceKey$,
  ]).pipe(
    map(
      ([compatibleDisplayTypes, selectedDataSourceKey]) =>
        compatibleDisplayTypes?.length === 0 || !selectedDataSourceKey
    ),
    tap(displayTypeDropdownDisabled => {
      if (displayTypeDropdownDisabled) {
        this.displayType?.disable();
      } else {
        this.displayType?.enable();
      }
    })
  );

  public readonly dataSourceConfiguration$ = new BehaviorSubject<ConfigurationOutput>({
    valid: false,
    data: {},
  });
  public readonly displayTypeConfiguration$ = new BehaviorSubject<ConfigurationOutput>({
    valid: false,
    data: {},
  });

  public readonly disabled$ = new BehaviorSubject<boolean>(false);

  private _openSubscription!: Subscription;

  public get title() {
    return this.form.get('title');
  }
  public get key() {
    return this.form.get('key');
  }
  public get dataSource() {
    return this.form.get('dataSource');
  }

  public get displayType() {
    return this.form.get('displayType');
  }

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService,
    private readonly notificationService: NotificationService,
    private readonly dashboardManagementService: DashboardManagementService,
    private readonly widgetService: WidgetService,
    private readonly widgetTranslationService: WidgetTranslationService
  ) {}

  public ngOnInit(): void {
    this.openOpenSubscription();
  }

  public ngOnDestroy(): void {
    this._openSubscription?.unsubscribe();
  }

  public closeModal(): void {
    this.open$.next(false);

    setTimeout(() => {
      this.enable();
      this.form.reset();
      this.selectedDataSourceKey$.next('');
      this.selectedDisplayTypeKey$.next('');
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  public save(): void {
    this.disable();

    combineLatest([
      this.selectedDataSourceKey$,
      this.selectedDisplayTypeKey$,
      this.displayTypeConfiguration$,
      this.dataSourceConfiguration$,
    ])
      .pipe(
        take(1),
        map(
          ([
            selectedDataSourceKey,
            selectedDisplayTypeKey,
            displayTypeConfiguration,
            dataSourceConfiguration,
          ]) => ({
            title: this.title.value,
            displayType: selectedDisplayTypeKey,
            dataSourceKey: selectedDataSourceKey,
            dataSourceProperties: {...dataSourceConfiguration.data},
            displayTypeProperties: {...displayTypeConfiguration.data},
          })
        ),
        switchMap(widgetUpdateObject =>
          this.type === 'create'
            ? this.dashboardManagementService.createDashboardWidgetConfiguration(
                this.dashboard.key,
                widgetUpdateObject
              )
            : this.dashboardManagementService.updateDashboardWidgetConfiguration(
                this.dashboard.key,
                {...widgetUpdateObject, key: this.widgetKey}
              )
        )
      )
      .subscribe({
        complete: () => {
          this.saveEvent.emit();
          this.closeModal();
        },
        error: () => {
          this.enable();
        },
      });
  }

  public delete(): void {
    this.disable();

    this.dashboardManagementService
      .deleteDashboardWidgetConfiguration(this.dashboard.key, this.widgetKey)
      .subscribe({
        complete: () => {
          this.saveEvent.emit();
          this.closeModal();
        },
        error: () => {
          this.enable();
        },
      });
  }

  public dataSourceSelected(dataSource: ListItem): void {
    if (!dataSource) {
      return;
    }

    this.selectedDataSourceKey$.next(dataSource?.item?.key);
    this.dataSource.setValue(dataSource?.item?.key);
  }

  public displayTypeSelected(displayType: ListItem): void {
    if (!displayType) {
      return;
    }

    this.selectedDisplayTypeKey$.next(displayType?.item?.key);
    this.displayType.setValue(displayType?.item?.key);
  }

  public dataSourceConfiguration(configuration: ConfigurationOutput): void {
    this.dataSourceConfiguration$.next(configuration);
  }

  public displayTypeConfiguration(configuration: ConfigurationOutput): void {
    this.displayTypeConfiguration$.next(configuration);
  }

  private openOpenSubscription(): void {
    this._openSubscription = this.showModal$.subscribe(show => {
      this.open$.next(show);
    });
  }

  private resetCompatibleDisplayTypes(): void {
    this._compatibleDisplayTypes$.next([]);
  }

  private setCompatibleDisplayTypes(
    dataSources: Array<WidgetDataSource>,
    selectedDataSourceKey: string
  ): void {
    this.widgetService.supportedDisplayTypes$.pipe(take(1)).subscribe(supportedDisplayTypes => {
      const selectedDataSource = dataSources.find(source => source.key === selectedDataSourceKey);
      const availableDataFeatures = selectedDataSource?.dataFeatures;
      const compatibleDisplayTypes = supportedDisplayTypes.filter(displayType => {
        const supportedDataFeatures = displayType.requiredDataFeatures.filter(
          requiredDataFeature =>
            !!availableDataFeatures?.some(
              availableDataFeature =>
                this.trimAndToUpperCase(availableDataFeature) ===
                this.trimAndToUpperCase(requiredDataFeature)
            )
        );
        return supportedDataFeatures.length === displayType.requiredDataFeatures.length;
      });

      this._compatibleDisplayTypes$.next(compatibleDisplayTypes);
    });
  }

  private disable(): void {
    this.disabled$.next(true);
    this.form.disable();
  }

  private enable(): void {
    this.disabled$.next(false);
    this.form.enable();
  }

  private trimAndToUpperCase(text: string): string {
    return `${text}`.trim().toUpperCase();
  }
}
