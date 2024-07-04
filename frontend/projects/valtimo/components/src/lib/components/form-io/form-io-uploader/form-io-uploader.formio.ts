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

import {Injector} from '@angular/core';
import {
  createCustomFormioComponent,
  FormioCustomComponentInfo,
  registerCustomFormioComponentWithClass,
} from '../../../modules';
import {FormIoUploaderComponent} from './form-io-uploader.component';
import {formIoUploaderEditForm} from './form-io-uploader-edit-form';

export const customUploaderType = 'valtimo-file';

const COMPONENT_OPTIONS: FormioCustomComponentInfo = {
  type: customUploaderType,
  selector: 'valtimo-form-io-uploader',
  title: 'Valtimo File Upload',
  group: 'basic',
  icon: 'upload',
  // set empty value to force formio to accept arrays as valid input value for this field type
  emptyValue: [],
  editForm: formIoUploaderEditForm,
};

export function registerFormioUploadComponent(injector: Injector) {
  const originalUploadComponent = createCustomFormioComponent(COMPONENT_OPTIONS);

  // override setValue function to allow for setting an array value
  class UploaderComponent extends originalUploadComponent {
    setValue(value): boolean {
      if (!this._customAngularElement) {
        return false;
      }

      let componentValue = this._customAngularElement?.value;

      if (componentValue) {
        componentValue = value;
      }

      return true;
    }
  }

  if (!customElements.get(COMPONENT_OPTIONS.selector)) {
    registerCustomFormioComponentWithClass(
      COMPONENT_OPTIONS,
      FormIoUploaderComponent,
      UploaderComponent,
      injector
    );
  }
}
