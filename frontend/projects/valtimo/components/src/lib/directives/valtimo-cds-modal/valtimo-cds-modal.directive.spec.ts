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

import {Component, CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ValtimoCdsModalDirective} from './valtimo-cds-modal.directive';

@Component({
  standalone: true,
  imports: [ValtimoCdsModalDirective],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <cds-modal valtimoCdsModal>
      <div class="cds--modal is-visible">
        <button class="cds--modal-close outer-close" type="button"></button>
        @if (showNested) {
          <cds-modal>
            <div class="cds--modal is-visible">
              <button class="cds--modal-close nested-close" type="button"></button>
            </div>
          </cds-modal>
        }
      </div>
    </cds-modal>
  `,
})
class TestHostComponent {
  public showNested = false;
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

  it('removes the document keydown listener on destroy', () => {
    const clickSpy = spyOn(outerClose, 'click');
    fixture.destroy();

    dispatchEscape();

    expect(clickSpy).not.toHaveBeenCalled();
  });
});
