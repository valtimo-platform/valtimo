/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
  Component,
  Output,
  EventEmitter,
  Input,
  OnInit,
  SimpleChanges,
  OnChanges,
} from '@angular/core';
import {ButtonType} from '../../models';

/**
 * @deprecated Migrate old design to Carbon
 */
@Component({
  selector: 'v-button',
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.scss'],
})
export class ButtonComponent implements OnInit, OnChanges {
  @Input() type: ButtonType = 'primary';
  @Input() mdiIcon!: string;
  @Input() disabled!: boolean;
  @Input() title = '';
  @Input() titleTranslationKey = '';
  @Output() clickEvent: EventEmitter<any> = new EventEmitter();

  isPrimary!: boolean;
  isSecondary!: boolean;
  isSuccess!: boolean;
  isText!: boolean;
  isIcon!: boolean;
  isIconSmall!: boolean;
  isIconDanger!: boolean;
  isIconGrey!: boolean;
  isDanger!: boolean;

  ngOnInit(): void {
    this.setIconTypes();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes?.type || changes?.mdiIcon) {
      this.setIconTypes();
    }
  }

  buttonClick(): void {
    if (!this.disabled) {
      this.clickEvent.emit();
    }
  }

  private setIconTypes(): void {
    switch (this.type) {
      case 'primary':
        this.isPrimary = true;
        break;
      case 'secondary':
        this.isSecondary = true;
        break;
      case 'success':
        this.isSuccess = true;
        break;
      case 'text':
        this.isText = true;
        break;
      case 'danger':
        this.isDanger = true;
        break;
      case 'icon-danger':
        this.isIcon = true;
        this.isIconDanger = true;
        break;
      case 'icon-grey':
        this.isIcon = true;
        this.isIconGrey = true;
        break;
      case 'icon-danger-small':
        this.isIconSmall = true;
        this.isIcon = true;
        this.isIconDanger = true;
        break;
      case 'icon-grey-small':
        this.isIconSmall = true;
        this.isIcon = true;
        this.isIconGrey = true;
        break;
    }
  }
}
