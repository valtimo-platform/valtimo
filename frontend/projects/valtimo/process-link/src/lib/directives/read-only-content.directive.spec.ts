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

import {ElementRef} from '@angular/core';
import {ReadOnlyContentDirective} from './read-only-content.directive';

describe('ReadOnlyContentDirective', () => {
  let host: HTMLElement;
  let directive: ReadOnlyContentDirective;

  const rendered = (html: string): Promise<void> => {
    host.innerHTML = html;
    return new Promise(resolve => setTimeout(resolve));
  };

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    directive = new ReadOnlyContentDirective(new ElementRef(host));
  });

  afterEach(() => {
    directive.ngOnDestroy();
    host.remove();
  });

  describe('when read-only', () => {
    beforeEach(() => {
      directive.readOnly = true;
      directive.ngOnInit();
    });

    it('should keep a text field readable but not editable', async () => {
      await rendered('<input type="text" value="start-form-bezwaar" />');

      const input = host.querySelector('input') as HTMLInputElement;

      expect(input.readOnly).toBe(true);
      expect(input.disabled).toBe(false);
      expect(input.value).toBe('start-form-bezwaar');
    });

    it('should keep a checkbox read-only rather than disabled', async () => {
      await rendered(`
        <div class="cds--checkbox-wrapper">
          <input class="cds--checkbox" id="check" type="checkbox" />
          <label for="check">On</label>
        </div>
      `);

      const checkbox = host.querySelector('input') as HTMLInputElement;
      (host.querySelector('label') as HTMLLabelElement).click();

      expect(checkbox.disabled).toBe(false);
      expect(checkbox.checked).toBe(false);
      expect(
        host
          .querySelector('.cds--checkbox-wrapper')
          ?.classList.contains('cds--checkbox-wrapper--readonly')
      ).toBe(true);
    });

    it('should give a Carbon toggle its read-only appearance', async () => {
      await rendered(`
        <div class="cds--toggle cds--form-item">
          <button class="cds--toggle__button" role="switch" type="button"></button>
          <label class="cds--toggle__label"><div class="cds--toggle__appearance"></div></label>
        </div>
      `);

      const toggle = host.querySelector('.cds--toggle') as HTMLElement;

      expect(toggle.classList.contains('cds--toggle--readonly')).toBe(true);
      expect((host.querySelector('button') as HTMLButtonElement).disabled).toBe(false);
      expect(toggle.classList.contains('cds--toggle--disabled')).toBe(false);
    });

    it('should give a Carbon combo box its read-only appearance', async () => {
      await rendered(`
        <div class="cds--list-box cds--combo-box">
          <div class="cds--list-box__field" role="button"></div>
          <input class="cds--text-input" role="combobox" type="text" />
        </div>
      `);

      const comboBox = host.querySelector('.cds--combo-box') as HTMLElement;

      expect(comboBox.classList.contains('cds--combo-box--readonly')).toBe(true);
      expect(host.querySelector('[role="combobox"]')?.getAttribute('aria-readonly')).toBe('true');
    });

    it('should give a field used without its Carbon wrapper a wrapper that is read-only', async () => {
      await rendered('<div class="v-input-container"><input class="cds--text-input" /></div>');

      expect(
        host
          .querySelector('.v-input-container')
          ?.classList.contains('cds--text-input-wrapper--readonly')
      ).toBe(true);
    });

    it('should leave out the actions that change the content', async () => {
      await rendered('<button class="cds--btn cds--btn--primary">Ondertitel toevoegen</button>');

      expect((host.querySelector('.cds--btn') as HTMLElement).style.display).toBe('none');
    });

    it('should keep selects and contenteditables from being edited', async () => {
      await rendered(`
        <select></select>
        <textarea></textarea>
        <div contenteditable="true"></div>
      `);

      expect((host.querySelector('select') as HTMLSelectElement).disabled).toBe(false);
      expect((host.querySelector('select') as HTMLSelectElement).getAttribute('tabindex')).toBe(
        '-1'
      );
      expect((host.querySelector('textarea') as HTMLTextAreaElement).readOnly).toBe(true);
      expect(host.querySelector('[contenteditable]')?.getAttribute('contenteditable')).toBe(
        'false'
      );
    });

    it('should neutralise the div-based clear action of a Carbon combo box', async () => {
      await rendered('<div role="button" tabindex="0" class="cds--list-box__selection"></div>');

      const clear = host.querySelector('.cds--list-box__selection') as HTMLElement;

      expect(clear.getAttribute('tabindex')).toBe('-1');
      expect(clear.getAttribute('aria-disabled')).toBe('true');
    });

    it('should put the content out of reach of the mouse, but keep the host scrollable', async () => {
      await rendered('<div class="step"><a href="#">Configuratie importeren</a></div>');

      expect((host.firstElementChild as HTMLElement).style.pointerEvents).toBe('none');
      expect(host.style.pointerEvents).toBe('');
    });

    it('should swallow clicks that reach the content anyway', async () => {
      await rendered('<div class="step"><input id="check" type="checkbox" /></div>');

      const checkbox = host.querySelector('#check') as HTMLInputElement;
      checkbox.click();

      expect(checkbox.checked).toBe(false);
    });

    it('should keep the content unclickable when Angular rebinds a disabled state', async () => {
      await rendered('<div><button id="import">Configuratie importeren</button></div>');

      (host.querySelector('#import') as HTMLButtonElement).disabled = false;

      expect((host.firstElementChild as HTMLElement).style.pointerEvents).toBe('none');
    });

    it('should take every focusable descendant out of the tab order', async () => {
      await rendered(`
        <input type="text" />
        <button>Configuratie importeren</button>
        <a href="#">link</a>
        <div tabindex="0" role="button"></div>
      `);

      const focusable = [...host.querySelectorAll('input, button, a, [tabindex]')];

      expect(focusable.length).toBe(4);
      expect(focusable.every(el => el.getAttribute('tabindex') === '-1')).toBe(true);
    });

    it('should mark controls that appear after the first render', async () => {
      await rendered('<span></span>');
      await rendered('<span></span><input type="text" />');

      expect((host.querySelector('input') as HTMLInputElement).readOnly).toBe(true);
    });
  });

  describe('when read-only ends', () => {
    beforeEach(() => {
      directive.readOnly = true;
      directive.ngOnInit();
    });

    it('should give the controls their original state back', async () => {
      await rendered(`
        <div class="step">
          <input type="text" />
          <textarea></textarea>
          <select></select>
          <div contenteditable="true"></div>
          <div role="button" tabindex="0"></div>
          <div class="cds--toggle"><button class="cds--toggle__button"></button></div>
          <div class="v-input-container"><input class="cds--text-input" /></div>
          <button class="cds--btn">Ondertitel toevoegen</button>
        </div>
      `);

      directive.readOnly = false;

      expect((host.querySelector('input[type="text"]') as HTMLInputElement).readOnly).toBe(false);
      expect((host.querySelector('textarea') as HTMLTextAreaElement).readOnly).toBe(false);
      expect((host.querySelector('select') as HTMLSelectElement).disabled).toBe(false);
      expect(host.querySelector('[contenteditable]')?.getAttribute('contenteditable')).toBe('true');
      expect(host.querySelector('[role="button"]')?.getAttribute('tabindex')).toBe('0');
      expect(host.querySelector('[role="button"]')?.hasAttribute('aria-disabled')).toBe(false);
      expect(host.querySelector('.cds--toggle')?.classList.contains('cds--toggle--readonly')).toBe(
        false
      );
      expect(
        host
          .querySelector('.v-input-container')
          ?.classList.contains('cds--text-input-wrapper--readonly')
      ).toBe(false);
      expect((host.querySelector('.cds--btn') as HTMLElement).style.display).toBe('');
      expect((host.firstElementChild as HTMLElement).style.pointerEvents).toBe('');
    });

    it('should let the content be used again', async () => {
      await rendered('<div class="step"><input id="check" type="checkbox" /></div>');

      directive.readOnly = false;

      const checkbox = host.querySelector('#check') as HTMLInputElement;
      checkbox.click();

      expect(checkbox.checked).toBe(true);
    });

    it('should not hand back a state the content never had', async () => {
      await rendered(`
        <div class="step">
          <input readonly type="text" />
          <div class="cds--toggle cds--toggle--readonly"></div>
        </div>
      `);

      directive.readOnly = false;

      expect((host.querySelector('input') as HTMLInputElement).readOnly).toBe(true);
      expect(host.querySelector('.cds--toggle')?.classList.contains('cds--toggle--readonly')).toBe(
        true
      );
    });

    it('should leave content that appears afterwards alone', async () => {
      await rendered('<span></span>');
      directive.readOnly = false;

      await rendered('<span></span><input type="text" />');

      expect((host.querySelector('input') as HTMLInputElement).readOnly).toBe(false);
    });
  });

  describe('when not read-only', () => {
    beforeEach(() => {
      directive.readOnly = false;
      directive.ngOnInit();
    });

    it('should leave the controls alone', async () => {
      await rendered(
        '<input type="text" /><button class="cds--btn"></button><select></select>' +
          '<div class="cds--toggle"></div>'
      );

      expect((host.querySelector('input') as HTMLInputElement).readOnly).toBe(false);
      expect((host.querySelector('button') as HTMLButtonElement).style.display).toBe('');
      expect((host.querySelector('select') as HTMLSelectElement).disabled).toBe(false);
      expect(host.querySelector('.cds--toggle')?.classList.contains('cds--toggle--readonly')).toBe(
        false
      );
      expect(
        [...host.children].every(child => (child as HTMLElement).style.pointerEvents === '')
      ).toBe(true);
    });
  });
});
