/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {CarbonTag} from '../../../models';
import {cloneDeep} from 'lodash';

@Component({
  selector: 'valtimo-tags-modal',
  templateUrl: './tags-modal.component.html',
  styleUrls: ['./tags-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CarbonTagsModalComponent {
  @Input() open = false;

  private _tags: CarbonTag[];
  @Input() public set tags(value: CarbonTag[]) {
    const deepCopy = cloneDeep(value);
    this._tags = deepCopy.sort((a: CarbonTag, b: CarbonTag) => (a.content < b.content ? -1 : 1));
  }
  public get tags(): CarbonTag[] {
    return this._tags;
  }

  @Output() public closeEvent = new EventEmitter();

  public onCloseSelect(): void {
    this.closeEvent.emit();
  }
}
