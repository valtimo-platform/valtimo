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

import {
  AlertsOptions,
  ErrorsOptions,
  FormioBeforeSubmit,
  FormioHookOptions,
  FormioOptions,
} from 'angular-formio/formio.common';

export interface FormioSubmission {
  data: {
    submit: boolean;
  };
  metadata: object;
  state: string;
}

export class AlertsOptionsImpl implements AlertsOptions {
  submitMessage: string;

  constructor(submitMessage: string) {
    this.submitMessage = submitMessage;
  }
}

export interface ValtimoFormioOptions extends FormioOptions {
  setAlertMessage(submitMessage: string);
  setHooks(submitFunction: FormioBeforeSubmit);
}

export class FormioOptionsImpl implements ValtimoFormioOptions {
  errors?: ErrorsOptions;
  alerts?: AlertsOptions;
  disableAlerts?: boolean;
  i18n?: object;
  fileService?: object;
  hooks?: FormioHookOptions;

  constructor() {}

  setAlertMessage(submitMessage: string) {
    this.alerts = new AlertsOptionsImpl(submitMessage);
  }

  setHooks(beforeSubmit: FormioBeforeSubmit) {
    this.hooks = {beforeSubmit: beforeSubmit};
  }
}
