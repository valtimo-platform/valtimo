/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import {ValtimoWindow} from '@valtimo/shared';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';

const formioParams$ = new BehaviorSubject<{
  caseDefinitionKey: string;
  caseDefinitionVersionTag: string;
} | null>(null);
let formioParamsSubscription: Subscription | null = null;

const modifyEditFormApiKeyInput = (editForm: any): void => {
  const keyField = editForm?.components
    ?.find(element => element?.key === 'tabs')
    ?.components?.find(element => element?.key === 'api')
    ?.components?.find(element => element?.key === 'key');

  if (keyField) delete keyField.validate;

  return editForm;
};

const addValueResolverSelectorToEditform = (editForm: any, params$: Observable<any>): void => {
  const valtimoWindow = window as ValtimoWindow;
  const valtimoTabKey = 'valtimo';

  // Unsubscribe from previous subscription if it exists
  if (formioParamsSubscription) {
    formioParamsSubscription.unsubscribe();
  }
  // Subscribe to the params Observable and forward values to the BehaviorSubject
  formioParamsSubscription = params$.subscribe(params => {
    formioParams$.next(params);
  });

  if (valtimoWindow?.flags?.formioValueResolverSelectorComponentRegistered) {
    const tabComponents = editForm?.components?.find(element => element.key === 'tabs')?.components;
    const hasValtimoTab = tabComponents?.find(component => component.key === valtimoTabKey);

    if (tabComponents && !hasValtimoTab) {
      tabComponents.push({
        label: 'Valtimo',
        key: valtimoTabKey,
        weight: 70,
        components: [
          {
            weight: 0,
            type: 'valtimo-value-resolver-selector',
            key: 'properties.sourceKey',
            label: 'Value resolver',
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

export {modifyEditFormApiKeyInput, addValueResolverSelectorToEditform, formioParams$};
