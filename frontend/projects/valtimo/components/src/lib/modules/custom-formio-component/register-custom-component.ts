/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

function registerCustomTag(tag: string, injector: Injector): void {
  injector.get(CustomTagsService).addCustomTag(tag);
}

function registerCustomFormioComponent(
  options: FormioCustomComponentInfo,
  angularComponent: Type<any>,
  injector: Injector
): void {
  registerCustomTag(options.selector, injector);

  if (!customElements.get(options.selector)) {
    const complexCustomComponent = createCustomElement(angularComponent, {injector});
    customElements.define(options.selector, complexCustomComponent);
  }

  Components.setComponent(options.type, createCustomFormioComponent(options));
}

export {registerCustomTag, registerCustomFormioComponent};
