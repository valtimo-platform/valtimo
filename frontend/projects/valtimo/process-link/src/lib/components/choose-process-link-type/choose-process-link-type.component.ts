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

import {Component, Input} from '@angular/core';
import {ProcessLinkStateService} from '../../services';
import {BehaviorSubject, Observable} from 'rxjs';

@Component({
  selector: 'valtimo-choose-process-link-type',
  templateUrl: './choose-process-link-type.component.html',
  styleUrls: ['./choose-process-link-type.component.scss'],
})
export class ChooseProcessLinkTypeComponent {
  private readonly _isFromCase$ = new BehaviorSubject<boolean>(false);
  @Input() public set isFromCase(value: boolean) {
    this._isFromCase$.next(value);
  }
  public get isFromCase$(): Observable<boolean> {
    return this._isFromCase$.asObservable();
  }
  public readonly availableProcessLinkTypes$ =
    this.processLinkStateService.availableProcessLinkTypes$;

  constructor(private readonly processLinkStateService: ProcessLinkStateService) {}

  selectProcessLinkType(processLinkTypeId: string): void {
    this.processLinkStateService.selectProcessLinkType(processLinkTypeId);
  }

  onBlockSelect(): void {
    console.log('block selected');
  }
}
