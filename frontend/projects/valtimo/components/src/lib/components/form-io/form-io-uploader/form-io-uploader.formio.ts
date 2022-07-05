import {Injector} from '@angular/core';
import {createCustomFormioComponent, FormioCustomComponentInfo, registerCustomFormioComponentWithClass,} from '@formio/angular';
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
      this._customAngularElement.value = value;
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
