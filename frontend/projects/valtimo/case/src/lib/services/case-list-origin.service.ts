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

import {Injectable} from '@angular/core';
import {NavigationEnd, Router} from '@angular/router';
import {BreadcrumbItem} from 'carbon-components-angular';
import {filter} from 'rxjs';

interface GroupOrigin {
  documentId: string;
  groupKey: string;
  groupTitle: string;
}

/**
 * Remembers the case group list a case was opened from, so the case breadcrumb leads back to that
 * group instead of the case definition list. Forgotten once the user leaves the case.
 */
@Injectable({providedIn: 'root'})
export class CaseListOriginService {
  private _groupOrigin: GroupOrigin | null = null;

  constructor(private readonly router: Router) {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        if (!this.isWithinCase(event.urlAfterRedirects)) this.clear();
      });
  }

  public setGroupOrigin(documentId: string, groupKey: string, groupTitle: string): void {
    this._groupOrigin = {documentId, groupKey, groupTitle};
  }

  public clear(): void {
    this._groupOrigin = null;
  }

  public getListBreadcrumb(
    documentId: string,
    caseDefinitionKey: string,
    caseDefinitionTitle: string
  ): BreadcrumbItem {
    const groupOrigin = this._groupOrigin?.documentId === documentId ? this._groupOrigin : null;
    const href = groupOrigin ? `/groups/${groupOrigin.groupKey}` : `/cases/${caseDefinitionKey}`;

    return {
      route: [href],
      content: groupOrigin?.groupTitle ?? caseDefinitionTitle,
      href,
    };
  }

  private isWithinCase(url: string): boolean {
    return !!this._groupOrigin && url.includes(`/document/${this._groupOrigin.documentId}`);
  }
}
