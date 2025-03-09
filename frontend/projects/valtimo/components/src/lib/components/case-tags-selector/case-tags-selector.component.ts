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

import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {BehaviorSubject, combineLatest, map, Observable} from 'rxjs';
import {InternalCaseStatus, InternalCaseStatusUtils} from '@valtimo/document';
import {
  CheckboxModule,
  DropdownModule,
  InputModule,
  ListItem,
  TagModule,
} from 'carbon-components-angular';
import {CARBON_THEME} from '../../models';
import {CommonModule} from '@angular/common';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {distinctUntilChanged, filter, take} from 'rxjs/operators';
import {isEqual} from 'lodash';
import {CASES_WITHOUT_STATUS_KEY} from '../../constants';

@Component({
  selector: 'valtimo-case-tags-selector',
  templateUrl: './case-tags-selector.component.html',
  styleUrls: ['./case-tags-selector.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DropdownModule, CheckboxModule, InputModule, TranslateModule, TagModule],
})
export class CaseTagsSelectorComponent {
  @Input() public set caseTags(value: InternalCaseStatus[]) {
    this._caseTags$.next(
      (value || []).map(caseTags => ({
        ...caseTags,
        tagType: InternalCaseStatusUtils.getTagTypeFromInternalCaseStatusColor(caseTags.color),
      }))
    );
  }
  @Input() public set selectedCaseTags(value: InternalCaseStatus[]) {
    this._selectedCaseTags$.next(value);
  }
  @Input() public carbonTheme: CARBON_THEME = CARBON_THEME.WHITE;
  @Input() public disabled!: boolean;

  @Output() public selectedStatusesChangeEvent = new EventEmitter<InternalCaseStatus[]>();

  private readonly _caseTags$ = new BehaviorSubject<InternalCaseStatus[]>([]);

  private readonly _selectedCaseTags$ = new BehaviorSubject<InternalCaseStatus[]>([]);

  public readonly CASES_WITHOUT_STATUS_KEY = CASES_WITHOUT_STATUS_KEY;

  public readonly listItems$: Observable<ListItem[]> = combineLatest([
    this._caseTags$,
    this._selectedCaseTags$,
    this.translateService.stream('key'),
  ]).pipe(
    filter(([caseTags, selectedCaseTags]) => !!caseTags && !!selectedCaseTags),
    map(([caseTags, selectedCaseTags]) =>
      caseTags.map(caseTag => ({
        content:
          caseTag.key === this.CASES_WITHOUT_STATUS_KEY
            ? this.translateService.instant('dossierManagement.tags.withoutStatus')
            : caseTag.title,
        selected: !!selectedCaseTags.find(selectedStatus => selectedStatus.key === caseTag.key),
        key: caseTag.key,
        tagType: caseTag.tagType,
      }))
    ),
    distinctUntilChanged((previous, current) => isEqual(previous, current))
  );

  constructor(private readonly translateService: TranslateService) {}

  public itemSelected(event: ListItem[]): void {
    const newSelectedItems = event?.filter(item => item?.selected) || [];

    this._caseTags$.pipe(take(1)).subscribe(caseTags => {
      const newSelectedCaseTags = newSelectedItems
        .map(item => caseTags.find(status => status.key === item.key))
        .filter(caseTag => !!caseTag);

      this.selectedStatusesChangeEvent.emit(newSelectedCaseTags);
    });
  }
}
