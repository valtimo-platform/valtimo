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
import {BasicWidget} from '@valtimo/layout';
import {of} from 'rxjs';

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

function startableItem(key: string, processDefinitionId: string | null): StartableItem {
  return {
    type: 'PROCESS',
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

function documentServiceStub(items: StartableItem[]): DocumentService {
  return {
    getStartableItems: () => of(items),
  } as unknown as DocumentService;
}

describe('WidgetProcess', () => {
  it('offers the process when it is in the startable items of the case', () => {
    const widget = new TestWidgetProcess(
      documentServiceStub([startableItem('test-process', 'test-process:1:abc')])
    );
    widget.setDocumentId('a-document-id');
    widget.setWidgetConfiguration(widgetConfiguration('test-process'));

    let canCreate: boolean | undefined;
    widget.canCreateCamundaExecution$.subscribe(value => (canCreate = value));

    expect(canCreate).toBe(true);
  });

  it('withholds the process when it is absent from the startable items of the case', () => {
    const widget = new TestWidgetProcess(
      documentServiceStub([startableItem('other-process', 'other-process:1:abc')])
    );
    widget.setDocumentId('a-document-id');
    widget.setWidgetConfiguration(widgetConfiguration('test-process'));

    let canCreate: boolean | undefined;
    widget.canCreateCamundaExecution$.subscribe(value => (canCreate = value));

    expect(canCreate).toBe(false);
  });

  it('withholds the process when the startable item has no deployed process definition', () => {
    const widget = new TestWidgetProcess(
      documentServiceStub([startableItem('test-process', null)])
    );
    widget.setDocumentId('a-document-id');
    widget.setWidgetConfiguration(widgetConfiguration('test-process'));

    let canCreate: boolean | undefined;
    widget.canCreateCamundaExecution$.subscribe(value => (canCreate = value));

    expect(canCreate).toBe(false);
  });

  it('withholds the process when the widget configures no process at all', () => {
    const widget = new TestWidgetProcess(
      documentServiceStub([startableItem('test-process', 'test-process:1:abc')])
    );
    widget.setDocumentId('a-document-id');
    widget.setWidgetConfiguration(widgetConfiguration());

    let canCreate: boolean | undefined;
    widget.canCreateCamundaExecution$.subscribe(value => (canCreate = value));

    expect(canCreate).toBe(false);
  });
});
