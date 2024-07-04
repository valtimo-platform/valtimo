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

import {Injectable, Renderer2, RendererFactory2, RendererStyleFlags2} from '@angular/core';
import {BehaviorSubject, combineLatest, Observable} from 'rxjs';
import {map, take, tap} from 'rxjs/operators';
import {VModalComponent} from '../components/v-modal/modal.component';
import {ModalData} from '../models';

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  private readonly _modalUuid$ = new BehaviorSubject<string>('');
  private readonly _modalVisible$ = new BehaviorSubject<boolean>(false);
  private readonly _appearing$ = new BehaviorSubject<boolean>(false);
  private readonly _disappearing$ = new BehaviorSubject<boolean>(false);
  private readonly _appearingDelayMs$ = new BehaviorSubject<number>(140);
  private readonly _modalData$ = new BehaviorSubject<ModalData>({});

  private renderer!: Renderer2;

  get modalUuid$() {
    return this._modalUuid$.asObservable();
  }

  get modalVisible$() {
    return this._modalVisible$.asObservable();
  }

  get appearing$() {
    return this._appearing$.asObservable();
  }

  get disappearing$() {
    return this._disappearing$.asObservable();
  }

  get appearingDelayMs$() {
    return this._appearingDelayMs$.asObservable();
  }

  get appearingDelayMs() {
    return this._appearingDelayMs$.getValue();
  }

  get modalData$() {
    return this._modalData$.asObservable();
  }

  constructor(public rendererFactory2: RendererFactory2) {
    this.renderer = rendererFactory2.createRenderer(null, null);
  }

  setCurrentModal(modalComponent: VModalComponent): void {
    this._modalUuid$.next(modalComponent.uuid);
  }

  setModalData(modalData: ModalData): void {
    this._modalData$.next(modalData);
  }

  clearModalData(): void {
    this._modalData$.next({});
  }

  openModal(modalComponent?: VModalComponent, modalData?: ModalData): void {
    this._modalVisible$.next(true);
    this.disablePageScroll();

    if (modalComponent) {
      this._modalUuid$.pipe(take(1)).subscribe(currentModalUuid => {
        if (modalComponent.uuid !== currentModalUuid) {
          this.setCurrentModal(modalComponent);
        }
      });
    }

    if (modalData) {
      this.setModalData(modalData);
    }
  }

  closeModal(callBackFunction?: () => void): void {
    this._disappearing$.next(true);
    this.setDisappearingTimeout();
    this._modalVisible$.next(false);
    this.enablePageScroll();

    if (callBackFunction) {
      setTimeout(() => {
        this.clearModalData();
        callBackFunction();
      }, this.appearingDelayMs);
    }
  }

  getModalVisible(modalUuid: string): Observable<boolean> {
    return combineLatest([this._modalVisible$, this._modalUuid$]).pipe(
      map(
        ([currentModalVisible, currentModalUuid]) =>
          currentModalVisible && currentModalUuid === modalUuid
      ),
      tap(visible => {
        if (visible) {
          this._appearing$.next(true);
          this.setAppearingTimeout();
        }
      })
    );
  }

  setAppearingDelay(appearingDelayMs: number): void {
    this._appearingDelayMs$.next(appearingDelayMs);
  }

  private setAppearingTimeout(): void {
    this._appearingDelayMs$.pipe(take(1)).subscribe(appearingDelayMs => {
      setTimeout(() => {
        this._appearing$.next(false);
      }, appearingDelayMs);
    });
  }

  private setDisappearingTimeout(): void {
    this._appearingDelayMs$.pipe(take(1)).subscribe(appearingDelayMs => {
      setTimeout(() => {
        this._disappearing$.next(false);
        this.clearModalData();
      }, appearingDelayMs);
    });
  }

  private disablePageScroll(): void {
    this.renderer.setStyle(
      document.getElementsByTagName('html')[0],
      'overflow',
      'hidden',
      RendererStyleFlags2.Important
    );
  }

  private enablePageScroll(): void {
    this.renderer.removeStyle(document.getElementsByTagName('html')[0], 'overflow');
  }
}
