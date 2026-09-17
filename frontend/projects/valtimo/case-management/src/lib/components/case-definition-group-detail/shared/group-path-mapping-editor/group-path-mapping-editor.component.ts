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
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {GroupMember, GroupPathMapping} from '../../../../models';

@Component({
  standalone: true,
  selector: 'valtimo-group-path-mapping-editor',
  templateUrl: './group-path-mapping-editor.component.html',
  styleUrl: './group-path-mapping-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule],
})
export class GroupPathMappingEditorComponent implements OnChanges {
  @Input() public groupKey: string | undefined;
  @Input() public itemKey: string | undefined;
  @Input() public itemType: 'list-column' | 'search-field' = 'list-column';
  @Input() public members: GroupMember[] = [];
  @Input() public mappings: GroupPathMapping[] = [];

  public editableMappings: Array<{caseDefinitionKey: string; path: string}> = [];

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['members'] || changes['mappings']) {
      this._buildEditableMappings();
    }
  }

  private _buildEditableMappings(): void {
    const mappingMap = new Map(this.mappings.map(m => [m.caseDefinitionKey, m.path]));
    this.editableMappings = this.members.map(member => ({
      caseDefinitionKey: member.caseDefinitionKey,
      path: mappingMap.get(member.caseDefinitionKey) ?? '',
    }));
  }
}
