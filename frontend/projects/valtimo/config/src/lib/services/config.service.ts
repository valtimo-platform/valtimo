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

import {ComponentFactoryResolver, Inject, Injectable, ViewContainerRef} from '@angular/core';
import {Extension, ExtensionLoader, ExtensionPoint, VALTIMO_CONFIG, ValtimoConfig} from '../models';
import {UrlUtils} from '../utils';

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private readonly extensionLoader: ExtensionLoader;
  private readonly extensions: Array<Extension> = [];
  private readonly DEFAULT_APPLICATION_TITLE = 'Valtimo';

  constructor(
    @Inject(VALTIMO_CONFIG) private valtimoConfig: ValtimoConfig,
    private componentFactoryResolver: ComponentFactoryResolver
  ) {
    this.extensionLoader = new ExtensionLoader(componentFactoryResolver);
  }

  public get config(): ValtimoConfig {
    const config = this.valtimoConfig;
    const translationResourcesConfig = config.translationResources;

    return {
      ...config,
      initializers: config.initializers || [],
      whitelistedDomains: config.whitelistedDomains.map(domain =>
        UrlUtils.formatUrlTrailingSlash(domain, false)
      ),
      mockApi: {
        ...config.mockApi,
        endpointUri: UrlUtils.formatUrlTrailingSlash(config.mockApi.endpointUri, true),
      },
      swagger: {
        ...config.swagger,
        endpointUri: UrlUtils.formatUrlTrailingSlash(config.swagger.endpointUri, false),
      },
      valtimoApi: {
        ...config.valtimoApi,
        endpointUri: UrlUtils.formatUrlTrailingSlash(config.valtimoApi.endpointUri, true),
      },
      ...(translationResourcesConfig && {
        translationResources: translationResourcesConfig.map(resource =>
          UrlUtils.formatUrlTrailingSlash(resource, true)
        ),
      }),
      applicationTitle: config.applicationTitle || this.DEFAULT_APPLICATION_TITLE,
    };
  }

  public get initializers() {
    return this.valtimoConfig?.initializers || [];
  }

  public addExtension(extension: Extension) {
    return this.extensions.push(extension);
  }

  public getSupportedExtensionPoint(module: string, page: string, section: string) {
    return this.extensions.find(extension =>
      extension.extensionPoint.supports(module, page, section)
    );
  }

  public getSupportedExtensionPoints(module: string, page: string, section: string) {
    return this.extensions.filter(extension =>
      extension.extensionPoint.supports(module, page, section)
    );
  }

  public loadExtensionPoint(viewContainerRef: ViewContainerRef, extensionPoint: ExtensionPoint) {
    this.extensionLoader.loadExtensionPoint(viewContainerRef, extensionPoint);
  }

  public loadAndReturnExtensionPoint(
    viewContainerRef: ViewContainerRef,
    extensionPoint: ExtensionPoint
  ) {
    return this.extensionLoader.loadAndClearExtensionPoint(viewContainerRef, extensionPoint);
  }
}
