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

import {Component, Input} from '@angular/core';
import {animate, style, transition, trigger} from '@angular/animations';

@Component({
  selector: 'v-tooltip',
  styleUrls: ['./tooltip.component.scss'],
  templateUrl: './tooltip.component.html',
  animations: [
    trigger('tooltip', [
      transition(':enter', [style({opacity: 0}), animate(300, style({opacity: 1}))]),
      transition(':leave', [animate(300, style({opacity: 0}))]),
    ]),
  ],
})
export class TooltipComponent {
  @Input() text = '';
}
