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
import {SecurityContext} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {DomSanitizer} from '@angular/platform-browser';
import {FormIoMailPreviewComponent} from './mail-preview.component';

/**
 * Regression tests for the stored-XSS sink described in SECURITY-mail-preview-xss.md.
 * The payload is deliberately benign: its `onerror` only sets an in-memory flag.
 */
describe('FormIoMailPreviewComponent — XSS sanitisation', () => {
  let fixture: ComponentFixture<FormIoMailPreviewComponent>;
  let component: FormIoMailPreviewComponent;
  let host: HTMLElement;

  const MARKER = '__mail_preview_xss_demo__';
  // Benign proof-of-execution payload: a broken image whose onerror only sets a
  // window flag. No exfiltration, no external request.
  const PAYLOAD = `<img src="x" onerror="window['${MARKER}'] = true">`;
  const originalTitle = document.title;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FormIoMailPreviewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FormIoMailPreviewComponent);
    component = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
    delete (window as unknown as Record<string, unknown>)[MARKER];
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>)[MARKER];
    document.title = originalTitle;
  });

  it('sanitizes attacker HTML: strips onerror and does not execute', () => {
    component.value = PAYLOAD;
    fixture.detectChanges();

    const content = host.querySelector('.mail-preview__content') as HTMLElement;
    const injectedImg = content.querySelector('img');

    expect(injectedImg).not.toBeNull();
    expect(injectedImg?.hasAttribute('onerror')).toBe(false);
    expect(content.innerHTML).not.toContain(MARKER);

    injectedImg?.dispatchEvent(new Event('error'));
    expect((window as unknown as Record<string, unknown>)[MARKER]).toBeUndefined();
  });

  it('FIDELITY: keeps benign formatting and hardens links', () => {
    component.value =
      '<table style="color:red"><tbody><tr><td>hi</td></tr></tbody></table><a href="https://x.test">l</a>';
    fixture.detectChanges();

    const content = host.querySelector('.mail-preview__content') as HTMLElement;
    const table = content.querySelector('table');
    const anchor = content.querySelector('a');

    expect(table).not.toBeNull();
    expect(table?.getAttribute('style')).toContain('color');
    expect(anchor?.getAttribute('target')).toBe('_blank');
    expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('BASELINE: Angular\'s HTML sanitiser strips the same handler', () => {
    // Contrast case: running the same payload through Angular's default sanitiser
    // (what a plain [innerHTML] binding does, as the neighbouring log-details view
    // does) removes the event handler, so nothing would execute. This is the
    // behaviour the fix should restore. See widget-text.component.ts.
    const sanitizer = TestBed.inject(DomSanitizer);
    const sanitized = sanitizer.sanitize(SecurityContext.HTML, PAYLOAD) ?? '';

    expect(sanitized).not.toContain('onerror');
    expect(sanitized).not.toContain(MARKER);
  });
});
