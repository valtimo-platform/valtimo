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
} from '@valtimo/components';
import {DocumentenApiUploaderComponent} from './documenten-api-uploader.component';
import {documentenApiUploaderEditForm} from './documenten-api-uploader-edit-form';

export const customDocumentApiUploaderType = 'documenten-api-file';

const COMPONENT_OPTIONS: FormioCustomComponentInfo = {
  type: customDocumentApiUploaderType,
  selector: 'documenten-api-form-io-uploader',
  title: 'Documenten API File Upload',
  group: 'advanced',
  icon: 'upload',
  // set empty value to force formio to accept arrays as valid input value for this field type
  emptyValue: [],
  editForm: documentenApiUploaderEditForm,
};

export function registerDocumentenApiFormioUploadComponent(injector: Injector) {
  const originalUploadComponent = createCustomFormioComponent(COMPONENT_OPTIONS);

  // override setValue function to allow for setting an array value
  class UploaderComponent extends originalUploadComponent {
    setValue(value): boolean {
      if (!this._customAngularElement) {
        return false;
      }

      // Re-apply customOptions on every setValue. FormIO calls setValue() right after evaluating
      // calculateValue, which can mutate this.component.customOptions as a side effect (e.g.
      // component.customOptions.filename = 'Test'). Because this subclass bypasses the base
      // setValue(), the base re-binding never runs, so we must re-bind here for those mutations to
      // reach the Angular element without depending on a redraw firing.
      this.bindCustomOptions();
      this._customAngularElement.value = value;
      return true;
    }
  }

  if (!customElements.get(COMPONENT_OPTIONS.selector)) {
    registerCustomFormioComponentWithClass(
      COMPONENT_OPTIONS,
      DocumentenApiUploaderComponent,
      UploaderComponent,
      injector
    );
  }
}
