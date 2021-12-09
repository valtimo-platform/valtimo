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

import {Component, OnInit, ViewEncapsulation} from '@angular/core';
import {DecisionService} from '../decision.service';
import DmnViewer from 'dmn-js';
import {DecisionXml} from '@valtimo/contract';
import {ActivatedRoute} from '@angular/router';

@Component({
  selector: 'valtimo-decision-display',
  templateUrl: './decision-display.component.html',
  styleUrls: ['./decision-display.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class DecisionDisplayComponent implements OnInit {

  public viewer: DmnViewer;
  private decisionId: string;
  public decisionXml: string;

  constructor(
    private decisionService: DecisionService,
    private route: ActivatedRoute
  ) {
  }

  ngOnInit() {
    this.viewer = new DmnViewer({
      container: '#canvas'
    });
    this.decisionId = this.route.snapshot.paramMap.get('id');
    this.loadDecisionXml();
  }

  loadDecisionXml(): void {
    this.decisionService.getDecisionXml(this.decisionId).subscribe((decision: DecisionXml) => {
      this.viewer.importXML(decision.dmnXml);
      this.decisionXml = decision.dmnXml;
    });
  }

  download(): void {
    const file = new Blob([this.decisionXml], {type: 'text/xml'});
    const link = document.createElement('a');
    link.download = `decision_table_${this.decisionId}.dmn`;
    link.href = window.URL.createObjectURL(file);
    link.click();
    window.URL.revokeObjectURL(link.href);
    link.remove();
  }

}
