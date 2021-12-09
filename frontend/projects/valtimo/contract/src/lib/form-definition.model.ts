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

import {FormioForm} from 'angular-formio';

export function compareFormDefinitions(fd1: FormDefinition, fd2: FormDefinition) {
  if (fd1 === null && fd2 === null) {
    return true;
  }
  if (fd1 === null || fd2 === null) {
    return false;
  }
  return fd1.id === fd2.id;
}

export interface FormDefinition {
  id: string;
  name: string;
  formDefinition: FormioForm;
  readOnly: boolean;
}

export interface CreateFormDefinitionRequest {
  name: string;
  formDefinition: string;
}

export interface ModifyFormDefinitionRequest {
  id: string;
  name: string;
  formDefinition: string;
}
