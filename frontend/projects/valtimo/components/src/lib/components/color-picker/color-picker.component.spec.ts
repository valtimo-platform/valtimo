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

import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {TranslateModule} from '@ngx-translate/core';
import {of} from 'rxjs';
import {CurrentCarbonTheme} from '../../models';
import {CdsThemeService} from '../../services';
import {ColorPickerComponent} from './color-picker.component';

describe('ColorPickerComponent', () => {
  let component: ColorPickerComponent;
  let fixture: ComponentFixture<ColorPickerComponent>;

  const waitForPickrInit = async (): Promise<void> => {
    for (let attempt = 0; attempt < 50 && !component['_initialized']; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    expect(component['_initialized']).toBeTrue();
  };

  const buttonColor = (): string =>
    (fixture.nativeElement.querySelector('.pcr-button') as HTMLElement).style.getPropertyValue(
      '--pcr-color'
    );

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ColorPickerComponent, TranslateModule.forRoot()],
      providers: [
        {provide: CdsThemeService, useValue: {currentTheme$: of(CurrentCarbonTheme.WHITE)}},
      ],
    }).compileComponents();
  }));

  beforeEach(async () => {
    fixture = TestBed.createComponent(ColorPickerComponent);
    component = fixture.componentInstance;
    component.writeValue('#0000ff');
    fixture.detectChanges();
    await waitForPickrInit();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('shows a color written from outside on the picker button', () => {
    component.writeValue('#ff0000');

    expect(buttonColor()).toBe('rgba(255, 0, 0, 1)');
  });

  it('does not emit a color change for a color written from outside', () => {
    const emitted: string[] = [];
    component.colorChangeEvent.subscribe(color => emitted.push(color));

    component.writeValue('#ff0000');

    expect(emitted).toEqual([]);
  });
});
