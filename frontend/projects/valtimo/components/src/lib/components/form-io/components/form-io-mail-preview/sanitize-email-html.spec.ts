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

import {sanitizeEmailHtml} from './sanitize-email-html';

describe('sanitizeEmailHtml', () => {
  const parse = (html: string): HTMLElement => {
    const el = document.createElement('div');
    el.innerHTML = sanitizeEmailHtml(html);
    return el;
  };

  it('strips script tags', () => {
    const out = sanitizeEmailHtml('<p>a</p><script>window.x=1</script>');
    expect(out).not.toContain('<script');
    expect(out).toContain('<p>a</p>');
  });

  it('strips on* event handlers', () => {
    const el = parse('<img src="x" onerror="alert(1)"><div onclick="alert(1)">d</div>');
    expect(el.querySelector('img')?.hasAttribute('onerror')).toBe(false);
    expect(el.querySelector('div')?.hasAttribute('onclick')).toBe(false);
  });

  it('strips javascript: hrefs', () => {
    const el = parse('<a href="javascript:alert(1)">x</a>');
    expect(el.querySelector('a')?.getAttribute('href') ?? '').not.toContain('javascript');
  });

  it('forbids form controls', () => {
    const el = parse('<form><input><button>b</button><textarea></textarea><select></select></form>');
    expect(el.querySelector('form,input,button,textarea,select')).toBeNull();
  });

  it('keeps inline style', () => {
    const el = parse('<p style="color:red">x</p>');
    expect(el.querySelector('p')?.getAttribute('style')).toContain('color');
  });

  it('keeps table elements', () => {
    const el = parse('<table><thead><tr><th>h</th></tr></thead><tbody><tr><td>c</td></tr></tbody></table>');
    expect(el.querySelector('table th')).not.toBeNull();
    expect(el.querySelector('table td')).not.toBeNull();
  });

  it('keeps img with data URI', () => {
    const src = 'data:image/png;base64,iVBORw0KGgo=';
    const el = parse(`<img src="${src}">`);
    expect(el.querySelector('img')?.getAttribute('src')).toBe(src);
  });

  it('adds target and rel to anchors', () => {
    const el = parse('<a href="https://x.test">l</a>');
    const a = el.querySelector('a');
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
