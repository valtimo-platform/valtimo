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

import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {LoadingModule, NotificationModule} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable, switchMap, tap} from 'rxjs';
import {ActivatedRoute} from '@angular/router';
import {filter} from 'rxjs/operators';

import {DocumentenApiManagementVersion} from '../../models';
import {DocumentenApiVersionService} from '../../services';

@Component({
  selector: 'valtimo-documenten-api-version',
  templateUrl: './documenten-api-version.component.html',
  styleUrls: ['./documenten-api-version.component.scss'],
  standalone: true,
  imports: [CommonModule, TranslateModule, LoadingModule, NotificationModule],
})
export class DocumentenApiVersionComponent {
  public readonly loading$ = new BehaviorSubject<boolean>(true);

  public readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params.name || ''),
    filter(documentDefinitionName => !!documentDefinitionName)
  );

  public readonly documentenApiVersion$: Observable<DocumentenApiManagementVersion> = combineLatest(
    [this.documentDefinitionName$, this.documentenApiVersionService.refresh$]
  ).pipe(
    tap(() => this.loading$.next(true)),
    switchMap(([documentDefinitionName]) =>
      this.documentenApiVersionService.getManagementApiVersion(documentDefinitionName)
    ),
    tap(() => this.loading$.next(false))
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly documentenApiVersionService: DocumentenApiVersionService
  ) {}
}
