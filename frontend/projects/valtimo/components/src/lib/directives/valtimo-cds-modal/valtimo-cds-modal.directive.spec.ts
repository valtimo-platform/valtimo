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

  it('closes only the open dropdown, not the modal, when a list-box is expanded inside the modal', () => {
    fixture.componentInstance.showExpandedDropdown = true;
    fixture.detectChanges();
    const clickSpy = spyOn(outerClose, 'click');
    const bodyClickSpy = jasmine.createSpy('bodyClick');
    document.body.addEventListener('click', bodyClickSpy);
    const event = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true});
    const stopSpy = spyOn(event, 'stopImmediatePropagation');

    document.dispatchEvent(event);

    // Modal is protected (event stopped, close button not clicked) and the open menu is closed via
    // a synthetic outside click on the body — which is how every Carbon list-box closes.
    expect(clickSpy).not.toHaveBeenCalled();
    expect(stopSpy).toHaveBeenCalled();
    expect(bodyClickSpy).toHaveBeenCalled();
    document.body.removeEventListener('click', bodyClickSpy);
  });

  it('detects an expanded list-box appended to the body (combo-box with appendInline=false)', () => {
    // A combo-box with `appendInline=false` relocates its expanded list-box out of the modal to the
    // document body, so detection must span the whole document, not just this modal.
    const bodyListBox = document.createElement('div');
    bodyListBox.className = 'cds--list-box cds--list-box--expanded';
    document.body.appendChild(bodyListBox);
    const clickSpy = spyOn(outerClose, 'click');
    const bodyClickSpy = jasmine.createSpy('bodyClick');
    document.body.addEventListener('click', bodyClickSpy);
    const event = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true});
    const stopSpy = spyOn(event, 'stopImmediatePropagation');

    document.dispatchEvent(event);

    expect(clickSpy).not.toHaveBeenCalled();
    expect(stopSpy).toHaveBeenCalled();
    expect(bodyClickSpy).toHaveBeenCalled();
    document.body.removeEventListener('click', bodyClickSpy);
    document.body.removeChild(bodyListBox);
  });

  it('removes the document keydown listener on destroy', () => {
    const clickSpy = spyOn(outerClose, 'click');
    fixture.destroy();

    dispatchEscape();

    expect(clickSpy).not.toHaveBeenCalled();
  });
});
