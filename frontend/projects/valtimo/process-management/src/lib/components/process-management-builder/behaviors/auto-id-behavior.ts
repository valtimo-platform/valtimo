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

import {getBusinessObject, is} from 'bpmn-js/lib/util/ModelUtil';
import {toKebabCase} from '@valtimo/shared';
import {MAX_ACTIVITY_ID_LENGTH} from '../../../constants';

const MAX_UNIQUE_SUFFIX = 100;
const TRAILING_SEPARATOR_REGEX = /[-_]+$/;

/**
 * Keeps the id of a newly drawn flow node in sync with its name, in kebab-case.
 *
 * Only elements created in the current editing session are touched, so ids of
 * already deployed elements — which milestones reference by task definition key —
 * are never rewritten. Editing the id by hand permanently releases the element.
 */
class AutoIdBehavior {
  static $inject = ['eventBus', 'modeling', 'elementRegistry'];

  private readonly _ownedElements = new WeakSet<object>();
  private _applyingId = false;

  constructor(
    eventBus: any,
    private readonly modeling: any,
    private readonly elementRegistry: any
  ) {
    eventBus.on('commandStack.shape.create.postExecuted', ({context}: any) => {
      const element = context?.shape;
      if (this.isEligible(element)) this._ownedElements.add(element);
    });

    // Read the previous id before the update is applied
    eventBus.on('commandStack.element.updateProperties.preExecute', ({context}: any) => {
      if (this._applyingId) return;

      const newId = context?.properties?.id;
      if (newId && newId !== context.element?.id) this._ownedElements.delete(context.element);
    });

    eventBus.on('commandStack.element.updateLabel.postExecuted', ({context}: any) =>
      this.syncIdWithName(context)
    );

    eventBus.on('commandStack.element.updateProperties.postExecuted', ({context}: any) => {
      // Editing an unrelated property must never move the id
      if (context?.properties?.name === undefined) return;

      this.syncIdWithName(context);
    });
  }

  private syncIdWithName(context: any): void {
    if (this._applyingId) return;

    const element = context?.element?.labelTarget ?? context?.element;
    if (!element || !this._ownedElements.has(element)) return;

    const name = getBusinessObject(element)?.name;
    if (!name) return;

    const baseId = toKebabCase(name, MAX_ACTIVITY_ID_LENGTH);
    if (!baseId || baseId === element.id) return;

    const uniqueId = this.resolveUniqueId(baseId, element);
    if (!uniqueId || uniqueId === element.id) return;

    this._applyingId = true;
    try {
      this.modeling.updateProperties(element, {id: uniqueId});
    } finally {
      this._applyingId = false;
    }
  }

  private isEligible(element: any): boolean {
    return !!element && !element.labelTarget && is(element, 'bpmn:FlowNode');
  }

  private isTaken(id: string, element: any): boolean {
    const existingElement = this.elementRegistry.get(id);
    if (existingElement && existingElement !== element) return true;

    // Covers moddle elements that are not on the canvas, e.g. the process itself
    const businessObject = getBusinessObject(element);
    const assigned = businessObject?.$model?.ids?.assigned(id);

    return !!assigned && assigned !== businessObject;
  }

  private resolveUniqueId(baseId: string, element: any): string | null {
    if (!this.isTaken(baseId, element)) return baseId;

    for (let counter = 2; counter <= MAX_UNIQUE_SUFFIX; counter++) {
      const suffix = `-${counter}`;
      const trimmedBase = baseId
        .slice(0, MAX_ACTIVITY_ID_LENGTH - suffix.length)
        .replace(TRAILING_SEPARATOR_REGEX, '');
      const candidate = `${trimmedBase}${suffix}`;

      if (!this.isTaken(candidate, element)) return candidate;
    }

    return null;
  }
}

const AutoIdBehaviorModule = {
  __init__: ['autoIdBehavior'],
  autoIdBehavior: ['type', AutoIdBehavior],
};

export {AutoIdBehaviorModule, AutoIdBehavior};
