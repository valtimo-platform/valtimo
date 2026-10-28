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

import {DocumentService, StartableItem} from '@valtimo/document';
import {of} from 'rxjs';

import {WidgetsService} from './widgets.service';

function startableItem(type: 'PROCESS' | 'BUILDING_BLOCK', name: string): StartableItem {
  return {
    type,
    name,
    key: 'test-process',
    versionTag: null,
    processDefinitionId: 'test-process:1:abc',
  } as StartableItem;
}

describe('WidgetsService', () => {
  it('starts the process, not a building block that shares its key', () => {
    const service = new WidgetsService({
      getStartableItems: () =>
        of([
          startableItem('BUILDING_BLOCK', 'the building block'),
          startableItem('PROCESS', 'the process'),
        ]),
    } as unknown as DocumentService);
    service.documentId = 'a-document-id';

    let started: StartableItem | undefined;
    service.activeProcess$.subscribe(item => (started = item));
    service.startProcess('test-process');

    expect(started?.name).toBe('the process');
  });

  it('starts nothing when only a building block carries the key', () => {
    const service = new WidgetsService({
      getStartableItems: () => of([startableItem('BUILDING_BLOCK', 'the building block')]),
    } as unknown as DocumentService);
    service.documentId = 'a-document-id';

    let started: StartableItem | undefined = startableItem('PROCESS', 'not set');
    service.activeProcess$.subscribe(item => (started = item));
    service.startProcess('test-process');

    expect(started).toBeUndefined();
  });
});
