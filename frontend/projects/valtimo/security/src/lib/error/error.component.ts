/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Error} from './error';

@Component({
  selector: 'valtimo-error',
  templateUrl: './error.component.html',
  styleUrls: ['./error.component.css']
})
export class ErrorComponent implements OnInit {
  public err: Error;

  constructor(
    private activatedRoute: ActivatedRoute,
  ) {
  }

  ngOnInit() {
    if (this.activatedRoute.snapshot.data) {
      this.err = {
        title: this.activatedRoute.snapshot.data.title,
        error: this.activatedRoute.snapshot.data.error
      };
    }
  }

}
