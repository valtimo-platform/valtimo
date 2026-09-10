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
import {Observable, Subject} from 'rxjs';
import {AssistantAppliedChange, AssistantRefreshHandler} from '../models';

/*
 * The assistant can change data that a screen is already showing, and every screen loads its
 * data its own way, so the assistant cannot know how to refresh any of them.
 *
 * A screen that wants to react registers a handler; it then owns its own refresh and no page
 * reload happens. While no screen has registered - the situation today - a full reload is the
 * fallback, so a confirmed change is never silently invisible.
 */
@Injectable({providedIn: 'root'})
export class AssistantRefreshService {
  private readonly _changeApplied$ = new Subject<AssistantAppliedChange>();

  public readonly changeApplied$: Observable<AssistantAppliedChange> =
    this._changeApplied$.asObservable();

  private readonly _handlers = new Set<AssistantRefreshHandler>();

  // Returns the unregister function, to be called from the screen's ngOnDestroy.
  public registerHandler(handler: AssistantRefreshHandler): () => void {
    this._handlers.add(handler);

    return () => this._handlers.delete(handler);
  }

  public notifyChangeApplied(change: AssistantAppliedChange): void {
    this._changeApplied$.next(change);

    if (this._handlers.size) {
      this._handlers.forEach(handler => handler(change));

      return;
    }

    this.reloadPage();
  }

  // Split out so a test can stub it and so the fallback is easy to find and delete.
  protected reloadPage(): void {
    location.reload();
  }
}
