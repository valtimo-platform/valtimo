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

import {Injector, Type} from '@angular/core';
import {createCustomElement} from '@angular/elements';
import {Components} from 'formiojs';
import {FormioCustomComponentInfo} from './elements.common';
import {createCustomFormioComponent} from './create-custom-component';
import {CustomTagsService} from '@formio/angular';

export function registerCustomTag(tag: string, injector: Injector): void {
  injector.get(CustomTagsService).addCustomTag(tag);
}

export function registerCustomTags(tags: string[], injector: Injector): void {
  tags.forEach(tag => registerCustomTag(tag, injector));
}

export function registerCustomFormioComponent(
  options: FormioCustomComponentInfo,
  angularComponent: Type<any>,
  injector: Injector
): void {
  registerCustomTag(options.selector, injector);

  const complexCustomComponent = createCustomElement(angularComponent, {injector});
  customElements.define(options.selector, complexCustomComponent);

  Components.setComponent(options.type, createCustomFormioComponent(options));
}

export function registerCustomFormioComponentWithClass(
  options: FormioCustomComponentInfo,
  angularComponent: Type<any>,
  formioClass: any,
  injector: Injector
): void {
  registerCustomTag(options.selector, injector);

  const complexCustomComponent = createCustomElement(angularComponent, {injector});
  customElements.define(options.selector, complexCustomComponent);

  Components.setComponent(options.type, formioClass);
}
