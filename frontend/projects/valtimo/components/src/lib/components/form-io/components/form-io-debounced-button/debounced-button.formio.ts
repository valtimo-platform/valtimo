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

import {Components} from 'formiojs';
import {Subject} from 'rxjs';
import {debounceTime} from 'rxjs/operators';

const BuiltInButton = (Components as any).components['button'];

const DEBOUNCE_TIME_MS = 1000;

/**
 * A button component with the exact same schema and behavior as Form.io's
 * built-in Button component, except that repeated clicks (double-clicks,
 * rapid Enter presses, etc.) within a `debounce` window are
 * ignored. This prevents the underlying action (typically `submit`) from
 * being triggered more than once in quick succession.
 */
class DebouncedButtonComponent extends BuiltInButton {
  private readonly click$ = new Subject<Event>();
  private emittedCount = 0;

  constructor(...args: any[]) {
    super(...args);

    this.click$
      .pipe(debounceTime(DEBOUNCE_TIME_MS, undefined))
      .subscribe(event => {
        this.emittedCount++;
        super.onClick(event);
      });
  }

  static schema(...extend: any[]) {
    return BuiltInButton.schema(
      {
        type: 'debouncedButton',
        debounce: DEBOUNCE_TIME_MS,
      },
      ...extend
    );
  }

  static get builderInfo() {
    return {
      title: 'Submit (debounced)',
      group: 'basic',
      icon: 'stop',
      documentation: '/userguide/form-building/form-components#button',
      weight: 111,
      schema: DebouncedButtonComponent.schema(),
    };
  }

  static editForm(...extend: any[]) {
    return BuiltInButton.editForm(...extend);
  }

  onClick(event: Event): void {
    const countBeforeClick = this.emittedCount;

    this.click$.next(event);

    if (this.emittedCount === countBeforeClick) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
}

export function registerDebouncedButtonComponent(): void {
  Components.setComponent('debouncedButton', DebouncedButtonComponent);
}
