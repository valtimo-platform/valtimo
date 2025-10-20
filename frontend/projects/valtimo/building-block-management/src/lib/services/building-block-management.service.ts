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

import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';

@Injectable()
export class BuildingBlockManagementService {
  private readonly _showCreateModal$ = new BehaviorSubject<boolean>(false);
  public readonly showCreateModal$ = this._showCreateModal$.asObservable();
  private readonly _usedKeys$ = new BehaviorSubject<string[]>([]);
  public readonly usedKeys$ = this._usedKeys$.asObservable();
  private readonly _reload$ = new BehaviorSubject<null>(null);
  public readonly reload$ = this._reload$.asObservable();

  public showCreateModal(): void {
    this._showCreateModal$.next(true);
  }

  public hideCreateModal(): void {
    this._showCreateModal$.next(false);
  }

  public setUsedKeys(keys: string[]): void {
    this._usedKeys$.next(keys);
  }

  public reload(): void {
    this._reload$.next(null);
  }
}
