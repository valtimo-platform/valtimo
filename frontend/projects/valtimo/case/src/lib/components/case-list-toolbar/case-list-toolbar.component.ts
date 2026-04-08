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

import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {ListField, ListHiddenColumn} from '@valtimo/components';

@Component({
  standalone: false,
  selector: 'valtimo-case-list-toolbar',
  templateUrl: './case-list-toolbar.component.html',
  styleUrls: ['./case-list-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseListToolbarComponent {
  @Input() public availableFields: ListField[] | null = null;
  @Input() public canCreate = false;
  @Input() public canExport = false;
  @Input() public disableExport = false;
  @Input() public disableStart = false;
  @Input() public hasApiColumnConfig = false;
  @Input() public hiddenColumns: ListField[] | null = null;
  @Input() public loadingExport = false;

  @Output() public exportEvent = new EventEmitter<void>();
  @Output() public startCaseEvent = new EventEmitter<void>();
  @Output() public viewUpdateEvent = new EventEmitter<ListHiddenColumn[]>();
}
