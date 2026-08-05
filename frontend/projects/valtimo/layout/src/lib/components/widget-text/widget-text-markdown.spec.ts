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
import {renderWidgetMarkdown} from './widget-text-markdown';

describe('renderWidgetMarkdown', () => {
  it('should return an empty string for empty content', () => {
    expect(renderWidgetMarkdown('')).toBe('');
    expect(renderWidgetMarkdown(null as unknown as string)).toBe('');
    expect(renderWidgetMarkdown(undefined as unknown as string)).toBe('');
  });

  it('should render a heading', () => {
    expect(renderWidgetMarkdown('## What is expected of you')).toContain(
      '<h2>What is expected of you</h2>'
    );
  });

  it('should render a bulleted list', () => {
    const html = renderWidgetMarkdown('- first\n- second');

    expect(html).toContain('<ul>');
    expect(html).toContain('<li>first</li>');
    expect(html).toContain('<li>second</li>');
  });

  it('should render bold and italic text', () => {
    const html = renderWidgetMarkdown('**bold** and *italic*');

    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('should treat a single newline as a line break', () => {
    expect(renderWidgetMarkdown('first line\nsecond line')).toContain('<br>');
  });

  it('should open links in a new tab without leaking the referrer', () => {
    const html = renderWidgetMarkdown('[intranet](https://intranet.example.org)');

    expect(html).toContain('href="https://intranet.example.org"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('should add the new tab attributes to raw html links as well', () => {
    const html = renderWidgetMarkdown('<a href="https://example.org">link</a>');

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('should keep relative links and fragments', () => {
    expect(renderWidgetMarkdown('[docs](/handbook)')).toContain('href="/handbook"');
    expect(renderWidgetMarkdown('[top](#top)')).toContain('href="#top"');
  });

  it('should keep mailto and tel links', () => {
    expect(renderWidgetMarkdown('[mail](mailto:info@example.org)')).toContain(
      'href="mailto:info@example.org"'
    );
    expect(renderWidgetMarkdown('[call](tel:+31612345678)')).toContain('href="tel:+31612345678"');
  });

  it('should drop a javascript href but keep the link text', () => {
    const html = renderWidgetMarkdown('[click](javascript:alert(1))');

    expect(html).not.toContain('javascript:');
    expect(html).toContain('click');
  });

  it('should drop a javascript href that hides control characters in the scheme', () => {
    const html = renderWidgetMarkdown('<a href="java\tscript:alert(1)">click</a>');

    expect(html).not.toContain('href=');
    expect(html).toContain('click');
  });

  it('should drop other dangerous schemes', () => {
    expect(renderWidgetMarkdown('[x](data:text/html;base64,PHNjcmlwdD4=)')).not.toContain('data:');
    expect(renderWidgetMarkdown('<a href="vbscript:msgbox(1)">x</a>')).not.toContain('vbscript:');
  });

  // Raw html is deliberately left alone: Angular's DomSanitizer is the single place where that is
  // dealt with, when the result is bound with [innerHTML]. This test pins the contract, so that a
  // future switch to bypassSecurityTrustHtml cannot silently make the output unsafe.
  it('should leave raw html untouched, leaving sanitization to Angular', () => {
    expect(renderWidgetMarkdown('<script>alert(1)</script>')).toContain('<script>');
  });
});
