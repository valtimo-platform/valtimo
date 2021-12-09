/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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
import {Extension, ExtensionLoader, ExtensionPoint, VALTIMO_CONFIG, ValtimoConfig} from '@valtimo/contract';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {

  private readonly extensionLoader: ExtensionLoader;
  private readonly extensions: Array<Extension> = [];

  constructor(
    @Inject(VALTIMO_CONFIG) private valtimoConfig: ValtimoConfig,
    private componentFactoryResolver: ComponentFactoryResolver
  ) {
    this.extensionLoader = new ExtensionLoader(componentFactoryResolver);
  }

  get config() {
    return this.valtimoConfig;
  }

  get initializers() {
    return this.valtimoConfig.initializers;
  }

  addExtension(extension: Extension) {
    return this.extensions.push(extension);
  }

  getSupportedExtensionPoint(module: string, page: string, section: string) {
    return this.extensions.find(extension => extension.extensionPoint.supports(module, page, section));
  }

  getSupportedExtensionPoints(module: string, page: string, section: string) {
    return this.extensions.filter(extension => extension.extensionPoint.supports(module, page, section));
  }

  loadExtensionPoint(viewContainerRef: ViewContainerRef, extensionPoint: ExtensionPoint) {
    this.extensionLoader.loadExtensionPoint(viewContainerRef, extensionPoint);
  }

  loadAndReturnExtensionPoint(viewContainerRef: ViewContainerRef, extensionPoint: ExtensionPoint) {
    return this.extensionLoader.loadAndClearExtensionPoint(viewContainerRef, extensionPoint);
  }

}
