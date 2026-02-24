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

import {ManagementContext, ValtimoWindow} from '@valtimo/shared';
import {Observable} from 'rxjs';

interface FormioContextParams {
  context: ManagementContext | null;
  caseDefinitionKey: string | null;
  caseDefinitionVersionTag: string | null;
  buildingBlockDefinitionKey: string | null;
  buildingBlockDefinitionVersionTag: string | null;
}

let formioParams: Observable<FormioContextParams>;

const modifyEditFormApiKeyInput = (editForm: any): void => {
  const keyField = editForm?.components
    ?.find(element => element?.key === 'tabs')
    ?.components?.find(element => element?.key === 'api')
    ?.components?.find(element => element?.key === 'key');

  if (keyField) delete keyField.validate;

  return editForm;
};

const addValueResolverSelectorToEditform = (
  editForm: any,
  params: Observable<FormioContextParams>
): void => {
  const valtimoWindow = window as ValtimoWindow;
  const valueResolverTabKey = 'valueResolver';
  formioParams = params;

  if (valtimoWindow?.flags?.formioValueResolverSelectorComponentRegistered) {
    const tabComponents = editForm?.components?.find(element => element.key === 'tabs')?.components;
    const hasValueResolverTab = tabComponents?.find(
      component => component.key === valueResolverTabKey
    );

    if (tabComponents && !hasValueResolverTab) {
      tabComponents.push({
        label: 'Value Resolver',
        key: valueResolverTabKey,
        weight: 70,
        components: [
          {
            weight: 0,
            type: 'valtimo-value-resolver-selector',
            key: 'properties.sourceKey',
            label: 'Source key',
            resolverType: 'source',
            validate: {
              required: false,
            },
          },
          {
            weight: 1,
            type: 'valtimo-value-resolver-selector',
            key: 'properties.targetKey',
            label: 'Target key',
            resolverType: 'target',
            validate: {
              required: false,
            },
          },
        ],
      });
    }
  }

  return editForm;
};

export {
  modifyEditFormApiKeyInput,
  addValueResolverSelectorToEditform,
  formioParams,
  FormioContextParams,
};
