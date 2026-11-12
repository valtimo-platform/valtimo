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

import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';

@Component({
  selector: 'valtimo-documenten-api-styles-host',
  template: '',
  styleUrls: ['./documenten-api-documents.component.scss'],
  standalone: true,
})
class StylesHostComponent {}

describe('DocumentenApiDocumentsComponent styles', () => {
  let container: HTMLElement;

  const appendPane = (content = '<span>Start</span>'): HTMLElement => {
    container = document.createElement('div');
    container.style.width = '400px';
    container.innerHTML = `<div class="cds--overflow-menu-options cds--overflow-menu-options--open">${content}</div>`;
    document.body.appendChild(container);
    return container.firstElementChild as HTMLElement;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({imports: [StylesHostComponent]});
    TestBed.createComponent(StylesHostComponent).detectChanges();
  });

  afterEach(() => {
    container?.remove();
  });

  it('does not change the width of other open overflow menus', () => {
    expect(appendPane().offsetWidth).toBe(400);
  });

  it('keeps the filter pane at its content width', () => {
    const pane = appendPane(
      '<valtimo-dossier-detail-tab-documenten-api-filter><span>Filter</span></valtimo-dossier-detail-tab-documenten-api-filter>'
    );

    expect(pane.offsetWidth).toBeLessThan(400);
  });
});
