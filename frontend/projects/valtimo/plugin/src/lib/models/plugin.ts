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

import {Component, EventEmitter, Input, Type} from '@angular/core';
import {Observable} from 'rxjs';
import {SafeResourceUrl} from '@angular/platform-browser';

interface PluginConfigurationData {
  configurationId: string;
  configurationTitle: string;
  [key: string]: any;
}

interface DefaultPluginConfigurationData {
  configurationId: string;
}

interface FunctionConfigurationData {
  [key: string]: any;
}

interface ConfigurationComponent {
  save$: Observable<void>;
  disabled$: Observable<boolean>;
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
      title: string;
      description: string;
      [translationKey: string]: string;
    };
  };
}

type PluginConfig = Array<PluginSpecification>;

type ConfigurationComponentType = 'function' | 'configuration';

interface PluginDefinition {
  key: string;
  description?: string;
  title?: string;
}

interface PluginDefinitionWithLogo extends PluginDefinition {
  pluginLogoBase64?: SafeResourceUrl;
}

interface PluginConfiguration {
  definitionKey?: string;
  pluginDefinition?: PluginDefinition;
  id?: string;
  newId?: string;
  title: string;
  properties: object;
}

interface PluginConfigurationWithLogo extends PluginConfiguration {
  pluginLogoBase64?: SafeResourceUrl;
}

interface PluginFunction {
  description?: string;
  key: string;
  title?: string;
}

export {
  PluginSpecification,
  PluginConfig,
  PluginConfigurationComponent,
  ConfigurationComponentType,
  PluginConfigurationData,
  DefaultPluginConfigurationData,
  FunctionConfigurationComponent,
  FunctionConfigurationData,
  PluginConfiguration,
  PluginDefinition,
  PluginFunction,
  PluginDefinitionWithLogo,
  PluginConfigurationWithLogo,
};
