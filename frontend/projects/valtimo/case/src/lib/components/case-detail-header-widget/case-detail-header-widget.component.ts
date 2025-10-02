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
import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ActivatedRoute} from '@angular/router';
import {distinctUntilChanged, filter, map, switchMap} from 'rxjs';
import {CaseHeaderWidgetApiService} from '../../services';

@Component({
  standalone: true,
  selector: 'valtimo-case-detail-header-widget',
  templateUrl: './case-detail-header-widget.component.html',
  styleUrls: ['./case-detail-header-widget.component.scss'],
  imports: [CommonModule],
})
export class CaseDetailHeaderWidgetComponent {
  private readonly _documentId$ = this.route.params.pipe(
    map(params => params?.documentId),
    filter(documentId => !!documentId),
    distinctUntilChanged()
  );

  public readonly headerWidget$ = this._documentId$.pipe(
    switchMap(documentId => this.caseHeaderWidgetApiService.getHeaderWidget(documentId))
  );

  constructor(
    private readonly caseHeaderWidgetApiService: CaseHeaderWidgetApiService,
    private readonly route: ActivatedRoute
  ) {
    this.headerWidget$.subscribe(x => console.log('header widget', x));
  }
}
