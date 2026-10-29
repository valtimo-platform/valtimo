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
import {FlowNodeMigration, ProcessService} from '@valtimo/process';
import {Observable, of} from 'rxjs';
import {catchError, shareReplay} from 'rxjs/operators';

/** Flow nodes per source/target definition pair. Per tab: the mapping child is rebuilt on every expand, and a definition id names one immutable deployment. */
@Injectable()
export class MigrationFlowNodeCacheService {
  private readonly _flowNodes = new Map<string, Observable<FlowNodeMigration | null>>();

  constructor(private readonly processService: ProcessService) {}

  /** Null when the lookup fails. A failure is not cached, so the next ask retries. */
  public getFlowNodes(
    sourceProcessDefinitionId: string,
    targetProcessDefinitionId: string
  ): Observable<FlowNodeMigration | null> {
    const key = `${sourceProcessDefinitionId}|${targetProcessDefinitionId}`;
    const cached = this._flowNodes.get(key);
    if (cached) return cached;

    const flowNodes$ = this.processService
      .getFlowNodes(sourceProcessDefinitionId, targetProcessDefinitionId)
      .pipe(
        catchError(() => {
          this._flowNodes.delete(key);
          return of(null);
        }),
        shareReplay(1)
      );
    this._flowNodes.set(key, flowNodes$);
    return flowNodes$;
  }
}
