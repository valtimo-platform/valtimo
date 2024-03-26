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

import {Component, Input, OnInit} from '@angular/core';
import {TitleType} from '../../models';

/**
 * @deprecated Migrate old design to Carbon
 */
@Component({
  selector: 'v-title',
  templateUrl: './title.component.html',
  styleUrls: ['./title.component.scss'],
})
export class TitleComponent implements OnInit {
  @Input() type: TitleType = 'h1';
  @Input() margin = true;
  @Input() fullWidth = false;
  @Input() center = false;

  isH1!: boolean;
  isH2!: boolean;

  ngOnInit(): void {
    this.setTitleType();
  }

  private setTitleType(): void {
    switch (this.type) {
      case 'h1':
        this.isH1 = true;
        break;
      case 'h2':
        this.isH2 = true;
        break;
    }
  }
}
