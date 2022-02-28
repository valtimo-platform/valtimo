/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

import {Component, Output, EventEmitter, Input, OnInit} from '@angular/core';
import {ButtonType} from '../../models';

@Component({
  selector: 'v-button',
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.scss'],
})
export class ButtonComponent implements OnInit {
  @Input() type: ButtonType = 'primary';
  @Input() mdiIcon!: string;
  @Input() disabled!: boolean;
  @Output() clickEvent: EventEmitter<any> = new EventEmitter();

  isPrimary!: boolean;
  isSecondary!: boolean;
  isSuccess!: boolean;
  isText!: boolean;

  ngOnInit(): void {
    const type = this.type;

    this.isPrimary = type === 'primary';
    this.isSecondary = type === 'secondary';
    this.isSuccess = type === 'success';
    this.isText = type === 'text';
  }
}
