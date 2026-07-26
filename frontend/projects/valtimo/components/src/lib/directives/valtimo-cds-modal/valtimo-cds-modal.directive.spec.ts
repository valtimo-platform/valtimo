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

import {Component, CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ValtimoCdsModalDirective} from '@valtimo/components';

@Component({
  standalone: true,
  imports: [ValtimoCdsModalDirective],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './valtimo-cds-modal.directive.spec.html',
})
class TestHostComponent {
  public showNested = false;
  public showExpandedDropdown = false;
}

describe('ValtimoCdsModalDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let outerClose: HTMLButtonElement;

  const dispatchEscape = (): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true});
    document.dispatchEvent(event);
    return event;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({imports: [TestHostComponent]});
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    outerClose = fixture.nativeElement.querySelector('.outer-close');
  });

  it('closes the top-most visible modal by clicking its own close button on ESC', () => {
    const clickSpy = spyOn(outerClose, 'click');

    dispatchEscape();

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('preempts other handlers via stopImmediatePropagation on ESC', () => {
    spyOn(outerClose, 'click');
    const event = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true});
    const stopSpy = spyOn(event, 'stopImmediatePropagation');

    document.dispatchEvent(event);

    expect(stopSpy).toHaveBeenCalled();
  });

  it('ignores non-Escape keys', () => {
    const clickSpy = spyOn(outerClose, 'click');

    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));

    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('does nothing when there is no visible modal', () => {
    const clickSpy = spyOn(outerClose, 'click');
    fixture.nativeElement.querySelector('.cds--modal').classList.remove('is-visible');

    dispatchEscape();

    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('does not react when its modal is not the top-most visible modal', () => {
    const clickSpy = spyOn(outerClose, 'click');
    const otherModal = document.createElement('div');
    otherModal.className = 'cds--modal is-visible';
    document.body.appendChild(otherModal);

    dispatchEscape();

    expect(clickSpy).not.toHaveBeenCalled();
    document.body.removeChild(otherModal);
  });

  it('does not close the outer modal when a nested modal is on top', () => {
    fixture.componentInstance.showNested = true;
    fixture.detectChanges();
    const clickSpy = spyOn(outerClose, 'click');

    dispatchEscape();

    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('shields the modal and lets Carbon close the menu when ESC fires inside an open combo-box', () => {
    fixture.componentInstance.showExpandedDropdown = true;
    fixture.detectChanges();
    const comboInput = fixture.nativeElement.querySelector('.combo-input') as HTMLInputElement;
    const clickSpy = spyOn(outerClose, 'click');
    const event = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true});
    const stopImmediateSpy = spyOn(event, 'stopImmediatePropagation');
    const stopPropagationSpy = spyOn(event, 'stopPropagation');

    // Dispatch from inside the open combo-box so the event target resolves to the list-box host.
    comboInput.dispatchEvent(event);

    // We do NOT preempt Carbon (no stopImmediatePropagation, close button not clicked) so Carbon
    // closes its own menu. The modal is shielded by a one-time keydown listener the directive adds
    // on the list-box host, which stops propagation before the ESC reaches the modal.
    expect(clickSpy).not.toHaveBeenCalled();
    expect(stopImmediateSpy).not.toHaveBeenCalled();
    expect(stopPropagationSpy).toHaveBeenCalled();
  });

  it('does not close the modal when a list-box is expanded outside it (appendInline=false menu)', () => {
    // A dropdown/combo-box with `appendInline=false` detaches its expanded menu to the body and
    // moves focus into it, so neither the marker nor the event target is inside the modal.
    // Detection is document-wide and the modal must not close (Carbon closes the detached menu).
    const detachedMenu = document.createElement('div');
    detachedMenu.className = 'cds--list-box cds--list-box--expanded';
    const focusedOption = document.createElement('div');
    detachedMenu.appendChild(focusedOption);
    document.body.appendChild(detachedMenu);
    const clickSpy = spyOn(outerClose, 'click');
    const event = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true});
    const stopImmediateSpy = spyOn(event, 'stopImmediatePropagation');

    focusedOption.dispatchEvent(event);

    expect(clickSpy).not.toHaveBeenCalled();
    expect(stopImmediateSpy).not.toHaveBeenCalled();
    document.body.removeChild(detachedMenu);
  });

  it('closes the modal when ESC is pressed and no list-box is expanded', () => {
    // Second ESC: the combo-box exists but its menu is closed (no `.cds--list-box--expanded`), so
    // ESC falls through to the modal close.
    fixture.componentInstance.showExpandedDropdown = true;
    fixture.detectChanges();
    const comboInput = fixture.nativeElement.querySelector('.combo-input') as HTMLInputElement;
    fixture.nativeElement
      .querySelector('.cds--list-box--expanded')
      .classList.remove('cds--list-box--expanded');
    const clickSpy = spyOn(outerClose, 'click');
    const event = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true});
    const stopImmediateSpy = spyOn(event, 'stopImmediatePropagation');

    comboInput.dispatchEvent(event);

    expect(stopImmediateSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('removes the document keydown listener on destroy', () => {
    const clickSpy = spyOn(outerClose, 'click');
    fixture.destroy();

    dispatchEscape();

    expect(clickSpy).not.toHaveBeenCalled();
  });
});
