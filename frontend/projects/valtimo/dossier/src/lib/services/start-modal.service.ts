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

import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class StartModalService {
  getStandardStartEventTitle(bpmnXml: string): string | null {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(bpmnXml, 'application/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length) {
      console.error('Error parsing XML');
      return null;
    }

    const startEvents = xmlDoc.getElementsByTagName('bpmn:startEvent');
    if (!startEvents) {
      return null;
    }

    const standardStartEvent = Array.from(startEvents).find(
      event =>
        !event.getElementsByTagName('bpmn:messageEventDefinition').length &&
        !event.getElementsByTagName('bpmn:timerEventDefinition').length
    );

    return standardStartEvent ? standardStartEvent.getAttribute('name') : null;
  }
}
