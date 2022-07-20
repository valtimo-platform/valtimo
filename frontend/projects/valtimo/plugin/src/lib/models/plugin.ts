/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.See the License for the specific language governing permissions and limitations under the License.
 */

import {Component, EventEmitter, Input, Type} from '@angular/core';
import {Observable} from 'rxjs';

interface PluginConfigurationData {
  configurationTitle?: string;
  [key: string]: any;
}

interface FunctionConfigurationData {
  [key: string]: any;
}

interface ConfigurationComponent {
  save$: Observable<void>;
  clear$: Observable<void>;
  disabled$: Observable<boolean>;
  error: boolean;
  pluginId: string;
  valid: EventEmitter<boolean>;
}

interface PluginConfigurationComponent extends ConfigurationComponent {
  prefillConfiguration$?: Observable<PluginConfigurationData>;
  configuration: EventEmitter<PluginConfigurationData>;
}

interface FunctionConfigurationComponent extends ConfigurationComponent {
  prefillConfiguration$?: Observable<FunctionConfigurationData>;
  configuration: EventEmitter<FunctionConfigurationData>;
}

interface PluginSpecification {
  pluginId: string;
  pluginLogoBase64: string;
  pluginConfigurationComponent: Type<PluginConfigurationComponent>;
  functionConfigurationComponents?: {
    [functionId: string]: Type<FunctionConfigurationComponent>;
  };
  pluginTranslations: {
    [langKey: string]: {
      [translationKey: string]: string;
    };
  };
}

type PluginConfig = Array<PluginSpecification>;

type ConfigurationComponentType = 'function' | 'configuration';

export {
  PluginSpecification,
  PluginConfig,
  PluginConfigurationComponent,
  ConfigurationComponentType,
  PluginConfigurationData,
  FunctionConfigurationComponent,
  FunctionConfigurationData,
};
