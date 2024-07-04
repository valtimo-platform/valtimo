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
  ComponentRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  Type,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {BehaviorSubject, combineLatest, Subscription} from 'rxjs';
import {tap} from 'rxjs/operators';
import {
  ConfigurationComponent,
  ConfigurationOutput,
  DataSourceConfigurationComponent,
  DisplayTypeConfigurationComponent,
  WidgetService,
} from '@valtimo/dashboard';

@Component({
  selector: 'valtimo-widget-configuration-container',
  templateUrl: './widget-configuration-container.component.html',
})
export class WidgetConfigurationContainerComponent
  implements OnInit, OnDestroy, ConfigurationComponent
{
  @ViewChild('widgetConfigurationComponent', {static: true, read: ViewContainerRef})
  private readonly _dynamicContainer: ViewContainerRef;

  @Input() public set dataSourceKey(value: string) {
    this._dataSourceKey$.next(value);
  }
  @Input() public set displayTypeKey(value: string) {
    this._displayTypeKey$.next(value);
  }
  @Input() public set disabled(disabledValue: boolean) {
    this._disabled$.next(disabledValue);
  }
  @Input() public set prefillConfiguration(prefillConfigurationValue) {
    this._prefillConfiguration$.next(prefillConfigurationValue);
  }
  @Output() public configurationEvent = new EventEmitter<ConfigurationOutput>();

  private _configurationSubscription!: Subscription;
  private readonly _subscriptions = new Subscription();

  private readonly _componentRef$ = new BehaviorSubject<
    ComponentRef<DataSourceConfigurationComponent | DisplayTypeConfigurationComponent> | undefined
  >(undefined);
  private readonly _dataSourceKey$ = new BehaviorSubject<string>('');
  private readonly _displayTypeKey$ = new BehaviorSubject<string>('');
  private readonly _disabled$ = new BehaviorSubject<boolean>(false);
  private readonly _prefillConfiguration$ = new BehaviorSubject<object | null>(null);

  constructor(private readonly widgetService: WidgetService) {}

  public ngOnInit(): void {
    this.openConfigurationComponentSubscription();
    this.openComponentInstanceSubscription();
    this.openDisabledSubscription();
    this.openPrefillConfigurationSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  private openConfigurationComponentSubscription(): void {
    this._subscriptions.add(
      combineLatest([
        this._displayTypeKey$,
        this._dataSourceKey$,
        this.widgetService.supportedDisplayTypes$,
        this.widgetService.supportedDataSources$,
      ])
        .pipe(
          tap(([displayTypeKey, dataSourceKey, supportedDisplayTypes, supportedDataSources]) => {
            let configurationComponent!: Type<
              DisplayTypeConfigurationComponent | DataSourceConfigurationComponent
            >;

            this._dynamicContainer.clear();

            const displayTypeSpecification =
              displayTypeKey &&
              supportedDisplayTypes.find(type => type.displayTypeKey === displayTypeKey);
            const dataSourceSpecification =
              dataSourceKey &&
              supportedDataSources.find(source => source.dataSourceKey === dataSourceKey);

            if (displayTypeSpecification && displayTypeSpecification.configurationComponent) {
              configurationComponent = displayTypeSpecification.configurationComponent;
            } else if (dataSourceSpecification && dataSourceSpecification.configurationComponent) {
              configurationComponent = dataSourceSpecification.configurationComponent;
            }

            if (configurationComponent) {
              const componentRef = this._dynamicContainer.createComponent(configurationComponent);
              this.configurationEvent.emit({valid: false, data: {}});
              this._componentRef$.next(componentRef);
            } else {
              this.configurationEvent.emit({valid: true, data: {}});
            }
          })
        )
        .subscribe()
    );
  }

  private openComponentInstanceSubscription(): void {
    this._subscriptions.add(
      combineLatest([this._componentRef$, this._dataSourceKey$, this._displayTypeKey$]).subscribe(
        ([ref, dataSourceKey, displayTypeKey]) => {
          const instance = ref?.instance;

          this._configurationSubscription?.unsubscribe();

          if (instance) {
            if (displayTypeKey) {
              (instance as DisplayTypeConfigurationComponent).displayTypeKey = displayTypeKey;
            } else if (dataSourceKey) {
              (instance as DataSourceConfigurationComponent).dataSourceKey = dataSourceKey;
            }

            this._configurationSubscription = instance.configurationEvent.subscribe(
              configuration => {
                this.configurationEvent.emit(configuration);
              }
            );
          }
        }
      )
    );
  }

  private openDisabledSubscription(): void {
    this._subscriptions.add(
      combineLatest([this._componentRef$, this._disabled$]).subscribe(([ref, disabled]) => {
        const instance = ref?.instance;

        if (instance) {
          instance.disabled = disabled;
        }
      })
    );
  }

  private openPrefillConfigurationSubscription(): void {
    this._subscriptions.add(
      combineLatest([this._componentRef$, this._prefillConfiguration$]).subscribe(
        ([ref, prefillConfiguration]) => {
          const instance = ref?.instance;

          if (instance && prefillConfiguration) {
            instance.prefillConfiguration = prefillConfiguration;
          }
        }
      )
    );
  }
}
