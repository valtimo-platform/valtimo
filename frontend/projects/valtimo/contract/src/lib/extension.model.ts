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

import {ComponentFactoryResolver, ComponentRef, ViewContainerRef} from '@angular/core';

export interface ExtensionPoint {
  module: string;
  page: string;
  section: string;
  component: any;
}

export class ExtensionLoader {
  private readonly componentFactoryResolver: ComponentFactoryResolver = null;
  private componentRef: ComponentRef<any> = null;

  constructor(componentFactoryResolver: ComponentFactoryResolver) {
    this.componentFactoryResolver = componentFactoryResolver;
  }

  loadExtensionPoint(viewContainerRef: ViewContainerRef, extensionPoint: ExtensionPoint) {
    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(extensionPoint.component);
    this.componentRef = viewContainerRef.createComponent(componentFactory);
  }

  loadAndClearExtensionPoint(viewContainerRef: ViewContainerRef, extensionPoint: ExtensionPoint) {
    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(extensionPoint.component);
    viewContainerRef.clear();
    return this.componentRef = viewContainerRef.createComponent(componentFactory);
  }
}

export class Extension {
  public readonly _name: string;
  public readonly _extensionPoint: BasicExtensionPoint;

  constructor(name: string, extensionPoint: BasicExtensionPoint) {
    this._name = name;
    this._extensionPoint = extensionPoint;
  }

  get extensionPoint(): BasicExtensionPoint {
    return this._extensionPoint;
  }

}

export class BasicExtensionPoint implements ExtensionPoint {
  private readonly _module: string;
  private readonly _page: string;
  private readonly _section: string;
  private readonly _component: any;

  constructor(module: string, page: string, section: string, component: any) {
    this._module = module;
    this._page = page;
    this._section = section;
    this._component = component;
  }

  supports(module: string, page: string, section: string): boolean {
    return this._module === module && this._page === page && this._section === section;
  }

  get module(): string {
    return this._module;
  }

  get page(): string {
    return this._page;
  }

  get section(): string {
    return this._section;
  }

  get component(): any {
    return this._component;
  }

}


