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
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormioModule} from '@formio/angular';
import {Components} from 'formiojs';
import {
  registerFormioSubmitOnceButtonComponent,
  SUBMIT_ONCE_BUTTON_TYPE,
  SUBMIT_ONCE_RELEASE_EVENT,
  SubmitOnceButton,
} from './submit-once-button.formio';

@Component({
  template: `<formio [form]="form" (submit)="submissions = submissions + 1" (ready)="renderer = $event"></formio>`,
  standalone: false,
})
class FormHostComponent {
  public form: any;
  public renderer: any;
  public submissions = 0;
}

describe('SubmitOnceButton', () => {
  let fixture: ComponentFixture<FormHostComponent>;

  // Longer than form.io's debounced change event, which is what re-enables the built-in button.
  const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 300));

  const renderForm = async (
    buttonType: string,
    nameRequired = false,
    extraButtons: Array<any> = []
  ): Promise<any> => {
    fixture = TestBed.createComponent(FormHostComponent);
    fixture.componentInstance.form = {
      components: [
        {type: 'textfield', key: 'name', label: 'Name', validate: {required: nameRequired}},
        {type: buttonType, key: 'submit', label: 'Submit', action: 'submit'},
        ...extraButtons,
      ],
    };
    fixture.detectChanges();

    for (let attempt = 0; attempt < 40 && !fixture.componentInstance.renderer; attempt++) {
      await settle();
      fixture.detectChanges();
    }

    return fixture.componentInstance.renderer.formio;
  };

  const button = (form: any): HTMLButtonElement => form.getComponent('submit').refs.button;

  const submissions = (): number => fixture.componentInstance.submissions;

  const fillName = async (form: any): Promise<void> => {
    form.getComponent('name').setValue('Jane');
    await settle();
  };

  const clickTwice = async (form: any): Promise<void> => {
    button(form).click();
    await settle();
    button(form).click();
    await settle();
  };

  const nameHighlighted = (form: any): boolean =>
    form.getComponent('name').element.classList.contains('formio-error-wrapper') &&
    !!form.getComponent('name').element.querySelector('input.is-invalid');

  beforeEach(async () => {
    registerFormioSubmitOnceButtonComponent();

    await TestBed.configureTestingModule({
      declarations: [FormHostComponent],
      imports: [FormioModule],
    }).compileComponents();
  });

  afterEach(() => fixture?.destroy());

  describe('registration', () => {
    it('should register the button as its own form.io component', () => {
      expect((Components.components as any)[SUBMIT_ONCE_BUTTON_TYPE]).toBe(SubmitOnceButton);
    });

    it('should offer the button in the basic group of the form builder', () => {
      expect(SubmitOnceButton.builderInfo.group).toBe('basic');
      expect(SubmitOnceButton.builderInfo.title).toBe('Submit once');
      expect(SubmitOnceButton.builderInfo.schema.type).toBe(SUBMIT_ONCE_BUTTON_TYPE);
    });

    it('should not let the builder change the button into another action', () => {
      const displayTab = SubmitOnceButton.editForm()
        .components.find((component: any) => component.type === 'tabs')
        .components.find((tab: any) => tab.key === 'display');

      expect(displayTab.components.some((component: any) => component.key === 'action')).toBe(
        false
      );
    });
  });

  describe('a valid form', () => {
    it('should submit only once when the button is clicked twice', async () => {
      const form = await renderForm(SUBMIT_ONCE_BUTTON_TYPE);
      await fillName(form);

      await clickTwice(form);

      expect(submissions()).toBe(1);
      expect(button(form).disabled).toBe(true);
    });

    it('should stay locked when the form changes after the submit', async () => {
      const form = await renderForm(SUBMIT_ONCE_BUTTON_TYPE);
      await fillName(form);

      button(form).click();
      await settle();
      form.getComponent('name').setValue('John');
      await settle();
      button(form).click();
      await settle();

      expect(submissions()).toBe(1);
    });

    it('should not let a second Submit once button on the same form submit again', async () => {
      const form = await renderForm(SUBMIT_ONCE_BUTTON_TYPE, false, [
        {type: SUBMIT_ONCE_BUTTON_TYPE, key: 'submitBottom', label: 'Submit', action: 'submit'},
      ]);
      const bottomButton: HTMLButtonElement = form.getComponent('submitBottom').refs.button;
      await fillName(form);

      button(form).click();
      await settle();
      bottomButton.click();
      await settle();

      expect(submissions()).toBe(1);
      expect(bottomButton.disabled).toBe(true);
    });

    it('should submit again once the host releases it after a failure', async () => {
      const form = await renderForm(SUBMIT_ONCE_BUTTON_TYPE);
      await fillName(form);

      button(form).click();
      await settle();
      form.emit(SUBMIT_ONCE_RELEASE_EVENT);
      await settle();

      expect(button(form).disabled).toBe(false);

      await clickTwice(form);

      expect(submissions()).toBe(2);
    });
  });

  describe('a form with an empty required field', () => {
    it('should highlight the field and stay usable instead of submitting', async () => {
      const form = await renderForm(SUBMIT_ONCE_BUTTON_TYPE, true);

      button(form).click();
      await settle();

      expect(submissions()).toBe(0);
      expect(nameHighlighted(form)).toBe(true);
      expect(button(form).disabled).toBe(false);
    });

    it('should submit once after the field is filled in', async () => {
      const form = await renderForm(SUBMIT_ONCE_BUTTON_TYPE, true);

      button(form).click();
      await settle();
      await fillName(form);
      await clickTwice(form);

      expect(submissions()).toBe(1);
    });
  });

  describe('the built-in submit button', () => {
    it('should still highlight an empty required field and submit once it is filled in', async () => {
      const form = await renderForm('button', true);

      button(form).click();
      await settle();

      expect(submissions()).toBe(0);
      expect(nameHighlighted(form)).toBe(true);

      await fillName(form);
      button(form).click();
      await settle();

      expect(submissions()).toBe(1);
    });

    it('should not be marked as failed by a release from the host', async () => {
      const form = await renderForm('button');
      await fillName(form);

      button(form).click();
      await settle();
      form.emit(SUBMIT_ONCE_RELEASE_EVENT);
      await settle();

      expect(button(form).classList.contains('submit-fail')).toBe(false);
    });
  });
});
