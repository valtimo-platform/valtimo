import {Injector} from '@angular/core';
import {FormIoCurrencyComponent} from './currency.component';
import {FormioCustomComponentInfo, registerCustomFormioComponent} from '../../../modules';
import {currencyEditForm} from './currency-edit-form';

const COMPONENT_OPTIONS: FormioCustomComponentInfo = {
  type: 'currency',
  selector: 'valtimo-currency',
  title: 'Currency',
  group: 'basic',
  icon: 'dollar',
  schema: {
    label: 'Currency component',
    key: 'currency',
    hideLabel: false,
    tableView: true,
    validate: {
      required: true,
    },
  },
  editForm: currencyEditForm,
};

export function registerFormioCurrencyComponent(injector: Injector) {
  registerCustomFormioComponent(COMPONENT_OPTIONS, FormIoCurrencyComponent, injector);
}
