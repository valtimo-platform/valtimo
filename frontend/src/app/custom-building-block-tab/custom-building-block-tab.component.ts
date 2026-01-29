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
import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';

@Component({
  selector: 'app-custom-building-block-tab',
  templateUrl: './custom-building-block-tab.component.html',
  standalone: false,
})
export class CustomBuildingBlockTabComponent implements OnInit {
  private buildingBlockDefinitionKey: string;
  private buildingBlockDefinitionVersionTag: string;

  constructor(private route: ActivatedRoute) {
    const snapshot = this.route.snapshot.paramMap;
    this.buildingBlockDefinitionKey = snapshot.get('buildingBlockDefinitionKey') || '';
    this.buildingBlockDefinitionVersionTag =
      snapshot.get('buildingBlockDefinitionVersionTag') || '';
  }

  ngOnInit() {}
}
