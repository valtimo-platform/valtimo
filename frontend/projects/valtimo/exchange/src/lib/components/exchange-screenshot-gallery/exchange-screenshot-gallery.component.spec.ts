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

import {ComponentFixture, TestBed} from '@angular/core/testing';
import {TranslateModule} from '@ngx-translate/core';
import {ExchangeScreenshotGalleryComponent} from './exchange-screenshot-gallery.component';

describe('ExchangeScreenshotGalleryComponent', () => {
  let fixture: ComponentFixture<ExchangeScreenshotGalleryComponent>;
  let emitted: Array<number>;

  const images = [
    'https://assets.example/1.png',
    'https://assets.example/2.png',
    'https://assets.example/3.png',
  ];

  const render = (index: number, imageList: ReadonlyArray<string> = images, open = true): void => {
    fixture.componentRef.setInput('images', imageList);
    fixture.componentRef.setInput('index', index);
    fixture.componentRef.setInput('open', open);
    fixture.detectChanges();
  };

  const find = (testId: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-test-id="${testId}"]`);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ExchangeScreenshotGalleryComponent, TranslateModule.forRoot()],
    });
    fixture = TestBed.createComponent(ExchangeScreenshotGalleryComponent);
    emitted = [];
    fixture.componentInstance.indexChange.subscribe(index => emitted.push(index));
  });

  it('keeps the image while closing so the fade-out is not empty', () => {
    render(1);
    render(1, images, false);

    expect(find('exchange-gallery-image')?.getAttribute('src')).toBe(images[1]);
  });

  it('shows the image at the given index', () => {
    render(1);

    expect(find('exchange-gallery-image')?.getAttribute('src')).toBe(images[1]);
  });

  it('wraps around with the previous and next buttons', () => {
    render(2);
    find('exchange-gallery-next')?.click();

    render(0);
    find('exchange-gallery-previous')?.click();

    expect(emitted).toEqual([0, 2]);
  });

  it('navigates with the arrow keys only while open', () => {
    render(0, images, false);
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight'}));

    render(0);
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight'}));
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft'}));

    expect(emitted).toEqual([1, 2]);
  });

  it('hides the arrows for a single image', () => {
    render(0, [images[0]]);

    expect(find('exchange-gallery-previous')).toBeNull();
    expect(find('exchange-gallery-next')).toBeNull();
  });
});
