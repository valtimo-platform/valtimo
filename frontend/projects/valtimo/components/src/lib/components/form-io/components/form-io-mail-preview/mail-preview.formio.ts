/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import {Injector} from '@angular/core';
import {FormioCustomComponentInfo, registerCustomFormioComponent} from '../../../../modules';
import {mailPreviewEditForm} from './mail-preview-edit-form';
import {FormIoMailPreviewComponent} from './mail-preview.component';

const COMPONENT_OPTIONS: FormioCustomComponentInfo = {
  type: 'valtimo-mail-preview',
  selector: 'valtimo-mail-preview',
  title: 'E-mail preview',
  group: 'advanced',
  icon: 'envelope',
  editForm: mailPreviewEditForm,
  schema: {
    label: 'E-mail preview',
    key: '',
    hideLabel: true,
  },
};

export function registerFormioMailPreviewComponent(injector: Injector) {
  registerCustomFormioComponent(COMPONENT_OPTIONS, FormIoMailPreviewComponent, injector);
}
