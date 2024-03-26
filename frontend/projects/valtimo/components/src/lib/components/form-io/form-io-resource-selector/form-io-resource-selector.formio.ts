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
import {Components, Formio} from 'formiojs';
import {DocumentService} from '@valtimo/document';
import {FormIoStateService} from '../services/form-io-state.service';
import {take} from 'rxjs/operators';
import {ResourceOption} from '../../../models';

const SelectComponent = Components.components.select;

export function registerFormioFileSelectorComponent(injector: Injector) {
  const documentService = injector.get(DocumentService);
  const stateService = injector.get(FormIoStateService);

  const unavailableMessage: ResourceOption = {
    label: 'could not retrieve documents',
    value: null,
  };

  function getDocumentResources(documentId: string): Promise<ResourceOption[]> {
    if (!documentId) {
      return new Promise(resolve => {
        resolve([unavailableMessage]);
      });
    }
    return documentService
      .getDocument(documentId)
      .toPromise()
      .then(document =>
        document.relatedFiles.map(relatedFile => ({
          label: relatedFile.fileName,
          value: relatedFile.fileId,
        }))
      )
      .catch(
        () =>
          new Promise(resolve => {
            resolve([unavailableMessage]);
          })
      );
  }

  class ResourceSelectorComponent extends SelectComponent {
    static schema(...extend) {
      return SelectComponent.schema({
        type: 'resource-selector',
        label: 'Resource selector',
        key: 'resource-selector',
        dataSrc: 'custom',
        dataType: 'string',
        valueProperty: 'value',
        asyncValues: true,
        data: {
          custom: 'values = instance.getResources()',
        },
        ...extend,
      });
    }

    getResources() {
      return stateService.documentId$
        .pipe(take(1))
        .toPromise()
        .then(documentId => getDocumentResources(documentId));
    }

    static get builderInfo() {
      return {
        title: 'Document picker',
        icon: 'th-list',
        group: 'basic',
        documentation: '/userguide/#textfield',
        weight: 0,
        schema: ResourceSelectorComponent.schema(),
      };
    }
  }

  Formio.use({
    components: {
      'resource-selector': ResourceSelectorComponent,
    },
  });
}
