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

import {Component, EventEmitter, OnInit, Output, ViewChild} from '@angular/core';
import {DecisionService} from '../decision.service';
import {ModalComponent} from '@valtimo/components';

@Component({
  selector: 'valtimo-decision-deploy',
  templateUrl: './decision-deploy.component.html',
  styleUrls: ['./decision-deploy.component.scss']
})
export class DecisionDeployComponent implements OnInit {
  public dmn: File | null = null;
  @Output() deploySuccessful = new EventEmitter();
  @ViewChild('decisionDeployModal') modal: ModalComponent;

  constructor(
    private decisionService: DecisionService
  ) {
  }

  ngOnInit() {
  }

  onChange(files: FileList): void {
    this.dmn = files.item(0);
  }

  deployDmn(): void {
    this.decisionService.deployDmn(this.dmn).subscribe(() => {
      this.modal.hide();
      this.deploySuccessful.emit();
    });
  }

  openModal() {
    this.modal.show();
  }

}
