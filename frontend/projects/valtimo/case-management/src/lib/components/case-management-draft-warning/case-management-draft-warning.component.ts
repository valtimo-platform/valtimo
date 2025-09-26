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

import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {NotificationContent, NotificationModule} from 'carbon-components-angular';
import {BehaviorSubject, Observable, combineLatest, map} from 'rxjs';

@Component({
  selector: 'valtimo-case-management-draft-warning',
  templateUrl: './case-management-draft-warning.component.html',
  styleUrl: './case-management-draft-warning.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, NotificationModule, TranslateModule],
})
export class CaseManagementDraftWarningComponent {
  private readonly _name$ = new BehaviorSubject<string>('');
  @Input() public set name(value: string) {
    this._name$.next(value);
  }
  public readonly notificationObj$: Observable<NotificationContent> = combineLatest([
    this._name$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([name]) => ({
      type: 'warning',
      lowContrast: true,
      title: this.translateService.instant('caseManagement.draftWarning.title'),
      message: this.translateService.instant('caseManagement.draftWarning.description', {name}),
      showClose: false,
    }))
  );

  constructor(private readonly translateService: TranslateService) {}
}
