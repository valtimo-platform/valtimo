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

import {Inject, Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/shared';
import {catchError, map, Observable, of, shareReplay, switchMap} from 'rxjs';
import {ASSISTANT_TRANSPORT, AssistantTransport} from './assistant-transport';

@Injectable({providedIn: 'root'})
export class AssistantAvailabilityService {
  /*
   * Three things must agree before the assistant is offered: the app enables the feature, the
   * backend module is enabled, and a chat model is actually configured. An unreachable or
   * unconfigured backend resolves to false instead of showing a chat that cannot answer.
   */
  public readonly available$: Observable<boolean> = this.configService.featureToggles$.pipe(
    switchMap(featureToggles =>
      featureToggles?.enableAssistant
        ? this.transport.getConfig().pipe(
            map(config => config.enabled && config.configured),
            catchError(() => of(false))
          )
        : of(false)
    ),
    shareReplay({bufferSize: 1, refCount: false})
  );

  constructor(
    @Inject(ASSISTANT_TRANSPORT) private readonly transport: AssistantTransport,
    private readonly configService: ConfigService
  ) {}
}
