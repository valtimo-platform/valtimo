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

import {AutoIdBehavior} from './auto-id-behavior';
import {MAX_ACTIVITY_ID_LENGTH} from '../../../constants';

describe('AutoIdBehavior', () => {
  let eventBus: FakeEventBus;
  let elementRegistry: FakeElementRegistry;
  let modeling: FakeModeling;

  beforeEach(() => {
    eventBus = new FakeEventBus();
    elementRegistry = new FakeElementRegistry();
    modeling = new FakeModeling(eventBus, elementRegistry);

    new AutoIdBehavior(eventBus, modeling, elementRegistry);
  });

  it('should derive the id from the name of a newly drawn element', () => {
    const task = createTask('Activity_0x8y9z1');

    rename(task, 'Uitvoeren onderzoeksverkenning');

    expect(task.id).toBe('uitvoeren-onderzoeksverkenning');
  });

  it('should keep following the name while the id was not touched by hand', () => {
    const task = createTask('Activity_0x8y9z1');

    rename(task, 'Beoordelen');
    rename(task, 'Beoordelen aanvraag');

    expect(task.id).toBe('beoordelen-aanvraag');
  });

  it('should leave an element that was not drawn in this session alone', () => {
    const task = addExisting('Activity_0x8y9z1');

    rename(task, 'Uitvoeren onderzoeksverkenning');

    expect(task.id).toBe('Activity_0x8y9z1');
  });

  it('should stop following the name once the id is edited by hand', () => {
    const task = createTask('Activity_0x8y9z1');

    rename(task, 'Beoordelen');
    modeling.updateProperties(task, {id: 'beoordelen-door-behandelaar'});
    rename(task, 'Beoordelen aanvraag');

    expect(task.id).toBe('beoordelen-door-behandelaar');
  });

  it('should suffix the id when another element already claims it', () => {
    addExisting('beoordelen');
    const task = createTask('Activity_0x8y9z1');

    rename(task, 'Beoordelen');

    expect(task.id).toBe('beoordelen-2');
  });

  it('should keep suffixing while ids are taken', () => {
    addExisting('beoordelen');
    addExisting('beoordelen-2');
    const task = createTask('Activity_0x8y9z1');

    rename(task, 'Beoordelen');

    expect(task.id).toBe('beoordelen-3');
  });

  it('should truncate a long name to the maximum activity id length', () => {
    const task = createTask('Activity_0x8y9z1');

    rename(
      task,
      'Beoordelen volledigheid aanvraag omgevingsvergunning bouwen en slopen door behandelaar'
    );

    expect(task.id.length).toBeLessThanOrEqual(MAX_ACTIVITY_ID_LENGTH);
    expect(task.id).toBe('beoordelen-volledigheid-aanvraag-omgevingsvergunning-bouwen-en');
  });

  it('should leave the id alone when the name yields nothing usable', () => {
    const task = createTask('Activity_0x8y9z1');

    rename(task, '123');

    expect(task.id).toBe('Activity_0x8y9z1');
  });

  it('should follow the name when it is changed from the properties panel', () => {
    const task = createTask('Activity_0x8y9z1');

    modeling.updateProperties(task, {name: 'Beoordelen aanvraag'});

    expect(task.id).toBe('beoordelen-aanvraag');
  });

  it('should not move the id when an unrelated property changes', () => {
    addExisting('beoordelen');
    const task = createTask('Activity_0x8y9z1');
    rename(task, 'Beoordelen');

    expect(task.id).toBe('beoordelen-2');

    modeling.updateProperties(task, {'camunda:assignee': 'someone'});

    expect(task.id).toBe('beoordelen-2');
  });

  it('should not touch elements that are not flow nodes', () => {
    const flow = createElement('Flow_0x8y9z1', ['bpmn:SequenceFlow']);
    eventBus.fire('commandStack.shape.create.postExecuted', {context: {shape: flow}});

    rename(flow, 'Ja');

    expect(flow.id).toBe('Flow_0x8y9z1');
  });

  const createElement = (id: string, types: string[]): any => {
    const businessObject: any = {
      id,
      $instanceOf: (type: string) => types.includes(type),
    };
    businessObject.$model = {ids: {assigned: (value: string) => elementRegistry.assigned(value)}};

    const element = {id, businessObject};
    elementRegistry.add(element);

    return element;
  };

  const addExisting = (id: string): any =>
    createElement(id, ['bpmn:FlowNode', 'bpmn:UserTask', 'bpmn:Activity']);

  const createTask = (id: string): any => {
    const task = addExisting(id);
    eventBus.fire('commandStack.shape.create.postExecuted', {context: {shape: task}});

    return task;
  };

  const rename = (element: any, name: string): void => {
    element.businessObject.name = name;
    eventBus.fire('commandStack.element.updateLabel.postExecuted', {context: {element}});
  };
});

class FakeEventBus {
  private readonly _handlers = new Map<string, ((payload: any) => void)[]>();

  public on(events: string | string[], handler: (payload: any) => void): void {
    for (const event of Array.isArray(events) ? events : [events]) {
      this._handlers.set(event, [...(this._handlers.get(event) ?? []), handler]);
    }
  }

  public fire(event: string, payload: any): void {
    for (const handler of this._handlers.get(event) ?? []) {
      handler(payload);
    }
  }
}

class FakeElementRegistry {
  private readonly _elements = new Map<string, any>();

  public add(element: any): void {
    this._elements.set(element.id, element);
  }

  public get(id: string): any {
    return this._elements.get(id);
  }

  public assigned(id: string): any {
    return this._elements.get(id)?.businessObject ?? false;
  }

  public updateId(element: any, id: string): void {
    this._elements.delete(element.id);
    element.id = id;
    element.businessObject.id = id;
    this._elements.set(id, element);
  }
}

class FakeModeling {
  constructor(
    private readonly eventBus: FakeEventBus,
    private readonly elementRegistry: FakeElementRegistry
  ) {}

  public updateProperties(element: any, properties: any): void {
    const context = {element, properties};

    this.eventBus.fire('commandStack.element.updateProperties.preExecute', {context});

    if (properties.id) this.elementRegistry.updateId(element, properties.id);

    if (properties.name !== undefined) element.businessObject.name = properties.name;

    this.eventBus.fire('commandStack.element.updateProperties.postExecuted', {context});
  }
}
