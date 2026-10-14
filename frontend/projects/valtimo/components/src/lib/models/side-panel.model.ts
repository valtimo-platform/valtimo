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

import {Injector, Type} from '@angular/core';
import {Observable} from 'rxjs';

/** Where panel content belongs, e.g. the case it was opened for. */
interface SidePanelOrigin {
  /** Plain text, or a stream for a label resolved after offering. */
  label: string | Observable<string>;
  route: Array<string>;
}

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
  /** Parent injector for the content, so it resolves the provider's route and page-scoped services. */
  injector?: Injector;
  /** Widens the panel while this content shows, without changing the user's preferred width. */
  minWidth?: number;
  /** Shown in the header as a link, and marked when the user is on another page. */
  origin?: SidePanelOrigin;
  /**
   * Marks the content with a pin, telling the user it stays open on other pages. A marker only:
   * the provider keeps that promise and decides when to withdraw.
   */
  pinned?: boolean;
  /**
   * The content's own width, used instead of the panel's stored width. The provider persists it:
   * the handle's `resized$` reports each resize.
   */
  width?: number;
}

/** Returned to the provider of an offer. */
interface SidePanelHandle {
  readonly dismissed$: Observable<void>;
  readonly replaced$: Observable<void>;
  /** The width the user resized the panel to while showing this content. */
  readonly resized$: Observable<number>;
  /** Hides the content but keeps it alive. Re-offer the same key to show it again. */
  hide(): void;
  withdraw(): void;
}

export {SidePanelHandle, SidePanelOffer, SidePanelOrigin};
