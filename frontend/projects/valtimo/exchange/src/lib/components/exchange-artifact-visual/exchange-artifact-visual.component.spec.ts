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
import {EXCHANGE_CATALOG_TEST_IDS} from '../../constants';
import {ExchangeArtifactVisualComponent} from './exchange-artifact-visual.component';

describe('ExchangeArtifactVisualComponent', () => {
  let fixture: ComponentFixture<ExchangeArtifactVisualComponent>;

  const query = (testId: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-test-id="${testId}"]`);

  const render = (logo: string | null, title = 'Zaak Plan'): void => {
    fixture = TestBed.createComponent(ExchangeArtifactVisualComponent);
    fixture.componentRef.setInput('logo', logo);
    fixture.componentRef.setInput('title', title);
    fixture.detectChanges();
  };

  beforeEach(() => TestBed.configureTestingModule({imports: [ExchangeArtifactVisualComponent]}));

  it('renders an image for a valid http logo', () => {
    render('https://cdn.example/logo.png');

    expect(query(EXCHANGE_CATALOG_TEST_IDS.tileLogo)).not.toBeNull();
    expect(query(EXCHANGE_CATALOG_TEST_IDS.tileMonogram)).toBeNull();
  });

  it('falls back to the monogram when the image fails to load', () => {
    render('https://cdn.example/logo.png');

    query(EXCHANGE_CATALOG_TEST_IDS.tileLogo)?.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(query(EXCHANGE_CATALOG_TEST_IDS.tileLogo)).toBeNull();
    expect(query(EXCHANGE_CATALOG_TEST_IDS.tileMonogram)).not.toBeNull();
  });

  it('shows the monogram for a non-http logo', () => {
    render('javascript:alert(1)');

    expect(query(EXCHANGE_CATALOG_TEST_IDS.tileLogo)).toBeNull();
    expect(query(EXCHANGE_CATALOG_TEST_IDS.tileMonogram)).not.toBeNull();
  });
});
