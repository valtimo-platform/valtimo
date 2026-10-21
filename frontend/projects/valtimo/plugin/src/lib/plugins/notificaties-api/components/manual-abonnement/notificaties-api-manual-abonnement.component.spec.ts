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

import {NO_ERRORS_SCHEMA, Pipe, PipeTransform} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Observable, of} from 'rxjs';
import {NOTIFICATIES_API_MANUAL_ABONNEMENT_TEST_IDS} from '../../../../constants';
import {NotificatiesApiManualAbonnementComponent} from './notificaties-api-manual-abonnement.component';

@Pipe({name: 'pluginTranslate', standalone: true})
class PluginTranslateStubPipe implements PipeTransform {
  public transform(translateKey: string): Observable<string> {
    return of(translateKey);
  }
}

describe('NotificatiesApiManualAbonnementComponent', () => {
  let fixture: ComponentFixture<NotificatiesApiManualAbonnementComponent>;
  const testIds = NOTIFICATIES_API_MANUAL_ABONNEMENT_TEST_IDS;

  const byTestId = (testId: string): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll(`[data-test-id="${testId}"]`));

  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [NotificatiesApiManualAbonnementComponent]})
      .overrideComponent(NotificatiesApiManualAbonnementComponent, {
        set: {imports: [CommonModule, PluginTranslateStubPipe], schemas: [NO_ERRORS_SCHEMA]},
      })
      .compileComponents();

    fixture = TestBed.createComponent(NotificatiesApiManualAbonnementComponent);
    fixture.componentInstance.pluginId = 'notificatiesapi';
  });

  it('should show the callback URL and every kanaal with its filters', () => {
    fixture.componentInstance.manualAbonnement = {
      callbackUrl: 'https://gateway.example.com/api/v1/notificatiesapi/callback',
      kanalen: [
        {naam: 'zaken', filters: {actie: 'create'}},
        {
          naam: 'objecten',
          filters: {objectType: 'https://objecttypen.example.com/1', actie: 'update'},
        },
      ],
    };
    fixture.detectChanges();

    expect(byTestId(testIds.callbackUrl)[0].textContent.trim()).toBe(
      'https://gateway.example.com/api/v1/notificatiesapi/callback'
    );
    const kanalen = byTestId(testIds.kanaal);
    expect(kanalen.length).toBe(2);
    expect(kanalen[0].querySelector('strong').textContent.trim()).toBe('zaken');
    expect(kanalen[0].textContent).toContain('actie = create');
    expect(kanalen[1].querySelector('strong').textContent.trim()).toBe('objecten');
    expect(kanalen[1].textContent).toContain('objectType = https://objecttypen.example.com/1');
    expect(kanalen[1].textContent).toContain('actie = update');
    expect(fixture.nativeElement.textContent).not.toContain('manualAbonnementSaveFirst');
  });

  it('should ask to save the configuration first when no kanalen are known', () => {
    fixture.componentInstance.manualAbonnement = null;
    fixture.detectChanges();

    expect(byTestId(testIds.callbackUrl).length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('manualAbonnementSaveFirst');
  });
});
