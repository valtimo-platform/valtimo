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
import {Component, Input, OnInit} from '@angular/core';
import {TimelineItem} from '../../models';
import {BehaviorSubject} from 'rxjs';

@Component({
  selector: 'valtimo-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss'],
  standalone: false,
})
export class TimelineComponent {
  public readonly items$ = new BehaviorSubject<Array<TimelineItem>>([]);
  @Input() public set items(value: Array<TimelineItem>) {
    this.items$.next(value);
  }

  public readonly actions$ = new BehaviorSubject<{[id: string]: object}>({});
  @Input() public set actions(value: any[]) {
    this.actions$.next(value.reduce((acc, curr) => ({...acc, [curr.id]: curr}), {}));
  }
}
