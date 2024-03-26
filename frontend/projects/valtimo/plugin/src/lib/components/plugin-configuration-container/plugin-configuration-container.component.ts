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
import {PluginService} from '../../services';
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {map, tap} from 'rxjs/operators';
import {
  ConfigurationComponentType,
  DefaultPluginConfigurationData,
  FunctionConfigurationComponent,
  PluginConfigurationComponent,
  PluginConfigurationData,
} from '../../models';
import {NGXLogger} from 'ngx-logger';

@Component({
  selector: 'valtimo-plugin-configuration-container',
  templateUrl: './plugin-configuration-container.component.html',
  styleUrls: ['./plugin-configuration-container.component.scss'],
})
export class PluginConfigurationContainerComponent
  implements OnInit, OnDestroy, Omit<PluginConfigurationComponent, 'pluginId'>
{
  @ViewChild('pluginConfigurationComponent', {static: true, read: ViewContainerRef})
  public dynamicContainer: ViewContainerRef;

  @Input() set type(type: ConfigurationComponentType) {
    this._componentType.next(type);
  }
  @Input() set pluginDefinitionKey(key: string) {
    this._pluginDefinitionKey.next(key);
  }
  @Input() set functionKey(key: string) {
    this._functionKey.next(key);
  }
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() prefillConfiguration$: Observable<any>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<PluginConfigurationData> =
    new EventEmitter<PluginConfigurationData>();

  readonly noConfigurationComponentAvailable$ = new BehaviorSubject<boolean>(false);
  readonly componentRef$ = new BehaviorSubject<
    ComponentRef<PluginConfigurationComponent | FunctionConfigurationComponent> | undefined
  >(undefined);

  private componentRefSubscription!: Subscription;
  private pluginSubscription!: Subscription;
  private validSubscription!: Subscription;
  private configurationSubscription!: Subscription;

  private readonly _componentType = new BehaviorSubject<ConfigurationComponentType | null>(null);
  private readonly _pluginDefinitionKey = new BehaviorSubject<string>('');
  private readonly _functionKey = new BehaviorSubject<string>('');
  private readonly _defaultConfiguration =
    new BehaviorSubject<DefaultPluginConfigurationData | null>(null);
  private readonly _validDefaultConfiguration = new BehaviorSubject<boolean>(true);

  readonly isTypeConfiguration$: Observable<boolean> = this._componentType.pipe(
    map(componentType => componentType === 'configuration'),
    tap(isTypeConfiguration => this._validDefaultConfiguration.next(!isTypeConfiguration))
  );

  constructor(private readonly pluginService: PluginService) {}

  ngOnInit(): void {
    this.openPluginSubscription();
    this.openComponentInstanceSubscription();
  }

  ngOnDestroy(): void {
    this.pluginSubscription?.unsubscribe();
    this.componentRefSubscription?.unsubscribe();
  }

  onDefaultConfiguration(defaultConfiguration: DefaultPluginConfigurationData) {
    this._defaultConfiguration.next(defaultConfiguration);
  }

  onValidDefaultConfiguration(valid: boolean) {
    this._validDefaultConfiguration.next(valid);
  }

  private openPluginSubscription(): void {
    this.pluginSubscription = combineLatest([
      this._pluginDefinitionKey,
      this._functionKey,
      this._componentType,
      this.pluginService.pluginSpecifications$,
    ])
      .pipe(
        tap(([pluginDefinitionKey, functionKey, componentType, pluginSpecifications]) => {
          let configurationComponent!: Type<
            PluginConfigurationComponent | FunctionConfigurationComponent
          >;

          this.dynamicContainer.clear();

          if (componentType === 'configuration' && pluginDefinitionKey) {
            configurationComponent = pluginSpecifications.find(
              specification => specification.pluginId === pluginDefinitionKey
            )?.pluginConfigurationComponent;
          } else if (componentType === 'function' && pluginDefinitionKey && functionKey) {
            const pluginSpecification = pluginSpecifications.find(
              specification => specification.pluginId === pluginDefinitionKey
            );
            configurationComponent =
              pluginSpecification?.functionConfigurationComponents[functionKey];
          }

          if (configurationComponent) {
            const componentRef = this.dynamicContainer.createComponent(configurationComponent);
            this.componentRef$.next(componentRef);
            this.noConfigurationComponentAvailable$.next(false);
          } else {
            this.noConfigurationComponentAvailable$.next(true);
          }
        })
      )
      .subscribe();
  }

  private openComponentInstanceSubscription(): void {
    this.componentRefSubscription = combineLatest([
      this.componentRef$,
      this._pluginDefinitionKey,
    ]).subscribe(([ref, pluginDefinitionKey]) => {
      const instance = ref?.instance;

      this.configurationSubscription?.unsubscribe();
      this.validSubscription?.unsubscribe();

      if (instance) {
        instance.save$ = this.save$;
        instance.disabled$ = this.disabled$;
        instance.pluginId = pluginDefinitionKey;

        if (this.prefillConfiguration$) {
          instance.prefillConfiguration$ = this.prefillConfiguration$;
        }

        this.validSubscription = combineLatest([
          instance.valid,
          this._validDefaultConfiguration,
        ]).subscribe(([instanceValid, defaultConfigurationValid]) => {
          this.valid.emit(instanceValid && defaultConfigurationValid);
        });

        this.configurationSubscription = instance.configuration.subscribe(configuration => {
          const configurationId = this._defaultConfiguration.value?.configurationId;
          this.configuration.emit({
            ...configuration,
            configurationId,
          } as any as PluginConfigurationData);
        });
      }
    });
  }
}
