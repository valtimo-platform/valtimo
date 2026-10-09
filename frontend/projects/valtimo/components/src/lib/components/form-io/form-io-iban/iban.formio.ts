import {Injector} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {FormIoIbanComponent} from './iban.component';
import {FormioCustomComponentInfo, registerCustomFormioComponent} from '../../../modules';
import {isValidIban} from './iban.validators';

const ERROR_MESSAGE_TRANSLATION_KEY = 'formioTranslations.formioIbanComponent.errorMessage';

const getComponentOptions = (injector: Injector): FormioCustomComponentInfo => ({
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
      required: false,
    },
  },
  customValidator: (value: string) =>
    isValidIban(value)
      ? null
      : injector.get(TranslateService).instant(ERROR_MESSAGE_TRANSLATION_KEY),
});

export function registerFormioIbanComponent(injector: Injector) {
  registerCustomFormioComponent(getComponentOptions(injector), FormIoIbanComponent, injector);
}
