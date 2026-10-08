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

import {Type} from '@angular/core';
import {Observable} from 'rxjs';

/**
 * Content offered to the app-wide side panel. [key] identifies the content: re-offering the current
 * key keeps the rendered component alive, a different key replaces it.
 */
interface SidePanelOffer {
  key: string;
  title: string;
  subtitle?: string;
  subtitleLink?: string | Array<string>;
  component: Type<unknown>;
  inputs?: Record<string, unknown>;
}

/** Returned to the provider of an offer. */
interface SidePanelHandle {
  readonly dismissed$: Observable<void>;
  readonly replaced$: Observable<void>;
  withdraw(): void;
}

export {SidePanelHandle, SidePanelOffer};
