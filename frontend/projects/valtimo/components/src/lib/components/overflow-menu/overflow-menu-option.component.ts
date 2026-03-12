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

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  Output,
} from '@angular/core';

@Component({
  selector: 'v-overflow-menu-option',
  template: `<button
    class="v-overflow-menu-option__btn"
    [class.v-overflow-menu-option__btn--danger]="type === 'danger'"
    [class.v-overflow-menu-option__btn--disabled]="disabled"
    [disabled]="disabled"
    [attr.data-test-id]="testId"
    [attr.id]="optionId"
    role="menuitem"
  >
    <ng-content></ng-content>
  </button>`,
  styleUrls: ['./overflow-menu-option.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class OverflowMenuOptionComponent {
  @Input() disabled = false;
  @Input() type: 'default' | 'danger' = 'default';
  @Input() testId: string | null = null;
  @Input() optionId: string | null = null;

  @Output() selected = new EventEmitter<void>();

  @HostBinding('attr.role') role = 'none';

  @HostListener('click', ['$event'])
  onClick(event: Event): void {
    if (this.disabled) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    this.selected.emit();
  }
}
