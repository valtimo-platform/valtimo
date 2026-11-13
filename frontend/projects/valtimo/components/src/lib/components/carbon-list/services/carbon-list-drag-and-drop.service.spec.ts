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

import {ElementRef} from '@angular/core';
import {CarbonListComponent} from '../carbon-list.component';
import {DragAndDropEvent} from '../../../models';
import {CarbonListDragAndDropService} from './carbon-list-drag-and-drop.service';

describe('CarbonListDragAndDropService', () => {
  const ROW_HEIGHT = 40;
  let host: HTMLElement;
  let rows: HTMLElement[];

  beforeEach(() => {
    host = document.createElement('div');
    host.style.cssText = 'position:fixed;top:0;left:0;width:300px;z-index:99999;background:#fff';
    const container = document.createElement('cds-table-container');
    const cdsTable = document.createElement('cds-table');
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    table.style.borderCollapse = 'collapse';
    rows = [0, 1, 2].map(() => {
      const tr = document.createElement('tr');
      tr.style.height = `${ROW_HEIGHT}px`;
      const td = document.createElement('td');
      td.style.width = '200px';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return tr;
    });
    table.appendChild(tbody);
    cdsTable.appendChild(table);
    container.appendChild(cdsTable);
    host.appendChild(container);
    document.body.appendChild(host);
  });

  afterEach(() => host.remove());

  it('reorders rows when :hover stays on the dragged row during the drag', () => {
    const originalQuerySelectorAll = document.querySelectorAll.bind(document);
    spyOn(document, 'querySelectorAll').and.callFake((selector: string) => {
      if (selector === ':hover') {
        const latched: Element[] = [];
        for (let el: Element | null = rows[0]; el; el = el.parentElement) latched.unshift(el);
        return latched as any as NodeListOf<Element>;
      }
      return originalQuerySelectorAll(selector);
    });

    const service = new CarbonListDragAndDropService();
    const events: DragAndDropEvent[] = [];
    service.dragAndDropEvents$.subscribe(event => events.push(event));
    service.setCarbonListElementRef(new ElementRef(host) as any as ElementRef<CarbonListComponent>);

    const row0Top = rows[0].getBoundingClientRect().top;
    const row1Rect = rows[1].getBoundingClientRect();
    service.startDrag(row0Top, 0);

    document.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: row1Rect.left + 5,
        clientY: row1Rect.top + row1Rect.height / 2,
      })
    );
    document.dispatchEvent(new MouseEvent('mouseup'));

    expect(events).toEqual([{startIndex: 0, newIndex: 1}]);
  });
});
