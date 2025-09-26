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

import {
  AlertsOptions,
  ErrorsOptions,
  FormioBeforeSubmit,
  FormioHookOptions,
  FormioOptions,
} from '@formio/angular';

interface FormioSubmission {
  data: {
    [key: string]: any;
    submit?: boolean;
  };
  metadata: object;
  state: string;
}

interface ResourceOption {
  label: string;
  value: string;
}

class AlertsOptionsImpl implements AlertsOptions {
  submitMessage: string;

  constructor(submitMessage: string) {
    this.submitMessage = submitMessage;
  }
}

interface ValtimoFormioOptions extends FormioOptions {
  setAlertMessage(submitMessage: string);
  setHooks(submitFunction: FormioBeforeSubmit);
}

class FormioOptionsImpl implements ValtimoFormioOptions {
  errors?: ErrorsOptions;
  alerts?: AlertsOptions;
  disableAlerts?: boolean;
  language?: string;
  i18n?: object;
  fileService?: object;
  hooks?: FormioHookOptions;
  readonly?: boolean;
  decimalSeparator?: string;
  thousandsSeparator?: string;

  constructor() {}

  setAlertMessage(submitMessage: string) {
    this.alerts = new AlertsOptionsImpl(submitMessage);
  }

  setHooks(beforeSubmit: FormioBeforeSubmit) {
    this.hooks = {beforeSubmit};
  }
}

interface ValidateOptions {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  custom?: any;
  customPrivate?: boolean;
  min?: number;
  max?: number;
  minSelectedCount?: number;
  maxSelectedCount?: number;
  minWords?: number;
  maxWords?: number;
  email?: boolean;
  url?: boolean;
  date?: boolean;
  day?: boolean;
  json?: string;
  mask?: boolean;
  minDate?: any;
  maxDate?: any;
}

interface BuilderInfo {
  title: string;
  group: string;
  icon: string;
  documentation?: string;
  weight?: number;
  schema?: ExtendedComponentSchema;
}

interface ComponentSchema<T = any> {
  type?: string;
  key?: string;
  label?: string;
  placeholder?: string;
  input?: boolean;
  tableView?: boolean;
  multiple?: boolean;
  protected?: boolean;
  prefix?: string;
  suffix?: string;
  defaultValue?: T;
  clearOnHide?: boolean;
  unique?: boolean;
  persistent?: boolean;
  hidden?: boolean;
  validate?: ValidateOptions;
  conditional?: ConditionalOptions;
  errors?: Object;
  logic?: Object[];
  customClass?: string;
  dataGridLabel?: boolean;
  labelPosition?: 'top' | 'bottom' | 'left' | 'right';
  labelWidth?: number;
  labelMargin?: number;
  description?: string;
  errorLabel?: string;
  tooltip?: string;
  hideLabel?: boolean;
  tabindex?: string;
  disabled?: boolean;
  autofocus?: boolean;
  dbIndex?: boolean;
  customDefaultValue?: any;
  calculateValue?: any;
  allowCalculateOverride?: boolean;
  widget?: any;
  refreshOn?: string;
  clearOnRefresh?: boolean;
  validateOn?: 'change' | 'blur';
}

type ExtendedComponentSchema<T = any> = ComponentSchema<T> & {[key: string]: any};

interface ConditionalOptions {
  show?: boolean;
  when?: string;
  eq?: string;
  json?: Object;
}

export {
  FormioSubmission,
  ResourceOption,
  AlertsOptionsImpl,
  FormioOptionsImpl,
  ValtimoFormioOptions,
  ValidateOptions,
  BuilderInfo,
  ComponentSchema,
  ExtendedComponentSchema,
  ConditionalOptions,
};
