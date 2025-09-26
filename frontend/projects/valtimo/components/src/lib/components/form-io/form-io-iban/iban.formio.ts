import {Injector} from '@angular/core';
import {FormIoIbanComponent} from './iban.component';
import {FormioCustomComponentInfo, registerCustomFormioComponent} from '../../../modules';

const COMPONENT_OPTIONS: FormioCustomComponentInfo = {
  type: 'iban',
  selector: 'valtimo-iban',
  title: 'Iban',
  group: 'basic',
  icon: 'bank',
  schema: {
    label: 'Iban component',
    key: 'iban',
    hideLabel: false,
    tableView: true,
    validate: {
      required: true,
    },
  },
};

export function registerFormioIbanComponent(injector: Injector) {
  registerCustomFormioComponent(COMPONENT_OPTIONS, FormIoIbanComponent, injector);
}
