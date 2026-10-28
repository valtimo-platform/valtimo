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

import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {DocumentService, StartableItem} from '@valtimo/document';
import {BasicWidget} from '@valtimo/layout';
import {SseService} from '@valtimo/sse';
import {filter, of, Subject} from 'rxjs';

import {WidgetProcess} from './widget-process';

/** The base class only exposes its inputs to subclasses, which is what a widget component is. */
class TestWidgetProcess extends WidgetProcess {
  public setDocumentId(value: string): void {
    this.baseDocumentId = value;
  }

  public setWidgetConfiguration(value: BasicWidget): void {
    this.baseWidgetConfiguration = value;
  }
}

function startableItem(
  key: string,
  processDefinitionId: string | null,
  type: 'PROCESS' | 'BUILDING_BLOCK' = 'PROCESS'
): StartableItem {
  return {
    type,
    name: key,
    key,
    versionTag: null,
    processDefinitionId,
  } as StartableItem;
}

function widgetConfiguration(processDefinitionKey?: string): BasicWidget {
  return {
    actions: processDefinitionKey ? [{processDefinitionKey}] : [],
  } as BasicWidget;
}

function documentServiceStub(...responses: StartableItem[][]): DocumentService {
  let call = 0;
  return {
    getStartableItems: () => of(responses[Math.min(call++, responses.length - 1)]),
  } as unknown as DocumentService;
}

const sseEvents$ = new Subject<{eventType: string; documentId: string}>();

const sseServiceStub = {
  getSseEventObservable: (eventType: string) =>
    sseEvents$.pipe(filter(event => event.eventType === eventType)),
};

function createWidget(documentService: DocumentService): TestWidgetProcess {
  return TestBed.runInInjectionContext(() => new TestWidgetProcess(documentService));
}

describe('WidgetProcess', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{provide: SseService, useValue: sseServiceStub}],
    });
  });

  it('offers the process when it is in the startable items of the case', () => {
    const widget = createWidget(
      documentServiceStub([startableItem('test-process', 'test-process:1:abc')])
    );
    widget.setDocumentId('a-document-id');
    widget.setWidgetConfiguration(widgetConfiguration('test-process'));

    let canCreate: boolean | undefined;
    widget.canCreateCamundaExecution$.subscribe(value => (canCreate = value));

    expect(canCreate).toBe(true);
  });

  it('withholds the process when it is absent from the startable items of the case', () => {
    const widget = createWidget(
      documentServiceStub([startableItem('other-process', 'other-process:1:abc')])
    );
    widget.setDocumentId('a-document-id');
    widget.setWidgetConfiguration(widgetConfiguration('test-process'));

    let canCreate: boolean | undefined;
    widget.canCreateCamundaExecution$.subscribe(value => (canCreate = value));

    expect(canCreate).toBe(false);
  });

  it('withholds the process when the startable item has no deployed process definition', () => {
    const widget = createWidget(documentServiceStub([startableItem('test-process', null)]));
    widget.setDocumentId('a-document-id');
    widget.setWidgetConfiguration(widgetConfiguration('test-process'));

    let canCreate: boolean | undefined;
    widget.canCreateCamundaExecution$.subscribe(value => (canCreate = value));

    expect(canCreate).toBe(false);
  });

  it('withholds the process when only a building block carries the configured key', () => {
    const widget = createWidget(
      documentServiceStub([startableItem('test-process', 'test-process:1:abc', 'BUILDING_BLOCK')])
    );
    widget.setDocumentId('a-document-id');
    widget.setWidgetConfiguration(widgetConfiguration('test-process'));

    let canCreate: boolean | undefined;
    widget.canCreateCamundaExecution$.subscribe(value => (canCreate = value));

    expect(canCreate).toBe(false);
  });

  it('offers the process when a building block shares its key and the process is startable', () => {
    const widget = createWidget(
      documentServiceStub([
        startableItem('test-process', 'test-process:1:abc', 'BUILDING_BLOCK'),
        startableItem('test-process', 'test-process:1:abc'),
      ])
    );
    widget.setDocumentId('a-document-id');
    widget.setWidgetConfiguration(widgetConfiguration('test-process'));

    let canCreate: boolean | undefined;
    widget.canCreateCamundaExecution$.subscribe(value => (canCreate = value));

    expect(canCreate).toBe(true);
  });

  it('withholds the process when the widget configures no process at all', () => {
    const widget = createWidget(
      documentServiceStub([startableItem('test-process', 'test-process:1:abc')])
    );
    widget.setDocumentId('a-document-id');
    widget.setWidgetConfiguration(widgetConfiguration());

    let canCreate: boolean | undefined;
    widget.canCreateCamundaExecution$.subscribe(value => (canCreate = value));

    expect(canCreate).toBe(false);
  });

  it('checks again when a document update of the case arrives, as the start menu does', fakeAsync(() => {
    const widget = createWidget(
      documentServiceStub([], [startableItem('test-process', 'test-process:1:abc')])
    );
    widget.setDocumentId('a-document-id');
    widget.setWidgetConfiguration(widgetConfiguration('test-process'));

    let canCreate: boolean | undefined;
    const subscription = widget.canCreateCamundaExecution$.subscribe(value => (canCreate = value));
    expect(canCreate).toBe(false);

    sseEvents$.next({eventType: 'DOCUMENT_UPDATED', documentId: 'a-document-id'});
    tick(300);

    expect(canCreate).toBe(true);
    subscription.unsubscribe();
  }));

  it('checks again when a task update of the case arrives, as the start menu does', fakeAsync(() => {
    const widget = createWidget(
      documentServiceStub([startableItem('test-process', 'test-process:1:abc')], [])
    );
    widget.setDocumentId('a-document-id');
    widget.setWidgetConfiguration(widgetConfiguration('test-process'));

    let canCreate: boolean | undefined;
    const subscription = widget.canCreateCamundaExecution$.subscribe(value => (canCreate = value));
    expect(canCreate).toBe(true);

    sseEvents$.next({eventType: 'TASK_UPDATE', documentId: 'a-document-id'});
    tick(300);

    expect(canCreate).toBe(false);
    subscription.unsubscribe();
  }));

  it('ignores updates of another case', fakeAsync(() => {
    const widget = createWidget(
      documentServiceStub([], [startableItem('test-process', 'test-process:1:abc')])
    );
    widget.setDocumentId('a-document-id');
    widget.setWidgetConfiguration(widgetConfiguration('test-process'));

    let canCreate: boolean | undefined;
    const subscription = widget.canCreateCamundaExecution$.subscribe(value => (canCreate = value));

    sseEvents$.next({eventType: 'DOCUMENT_UPDATED', documentId: 'another-document-id'});
    tick(300);

    expect(canCreate).toBe(false);
    subscription.unsubscribe();
  }));
});
