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

import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {MilestoneService} from '../milestone.service';
import {Router} from '@angular/router';
import {AlertService} from '@valtimo/components';
import {Milestone, MilestoneSet} from '../models';
import {ProcessService, ProcessDefinition} from '@valtimo/process';

@Component({
  selector: 'valtimo-milestone-create',
  templateUrl: './milestone-create.component.html',
  styleUrls: ['./milestone-create.component.scss'],
})
export class MilestoneCreateComponent implements OnInit {
  public form: FormGroup;
  public milestoneSets: MilestoneSet[] = [];
  public processDefinitions: ProcessDefinition[] = [];
  public taskDefinitions: any[] = [];

  constructor(
    private milestoneService: MilestoneService,
    private formBuilder: FormBuilder,
    private router: Router,
    private alertService: AlertService,
    private processService: ProcessService
  ) {}

  get formControls() {
    return this.form.controls;
  }

  ngOnInit() {
    this.form = this.formBuilder.group({
      milestoneSet: new FormControl('', Validators.required),
      title: new FormControl('', Validators.required),
      processDefinitionKey: new FormControl('', Validators.required),
      taskDefinitionKey: new FormControl('', Validators.required),
      plannedIntervalInDays: new FormControl('', [
        Validators.required,
        Validators.pattern('^[0-9]*$'),
      ]),
      color: new FormControl('', [
        Validators.required,
        Validators.pattern('^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'),
      ]),
    });
    this.getMilestoneSets();
    this.getMilestones();
  }

  reset() {
    this.form.patchValue({
      milestoneSet: '',
      title: '',
      processDefinitionKey: '',
      taskDefinitionKey: '',
      plannedIntervalInDays: '',
      color: '',
    });
  }

  getMilestoneSets() {
    this.milestoneService.getMilestoneSets().subscribe((milesetoneSets: MilestoneSet[]) => {
      this.milestoneSets = milesetoneSets;
    });
  }

  getMilestones() {
    this.processService
      .getProcessDefinitions()
      .subscribe((processDefinitions: ProcessDefinition[]) => {
        this.processDefinitions = processDefinitions;
      });
  }

  getFlownodes(processDefinitionId: string) {
    if (processDefinitionId) {
      this.milestoneService.getFlownodes(processDefinitionId).subscribe((flowNodes: any[]) => {
        this.taskDefinitions = flowNodes['flowNodeMap'];
        this.form.controls.taskDefinitionKey.setValue('');
      });
    }
  }

  createMilestone() {
    const milestone: Milestone = this.form.value;
    milestone.processDefinitionKey = milestone.processDefinitionKey['key'];
    milestone.id = null;
    this.milestoneService.createMilestone(milestone).subscribe(
      () => {
        this.router.navigate(['/milestones']);
        this.alertService.success('New Milestone has been created');
      },
      err => {
        this.alertService.error('Error creating new milestone');
      }
    );
  }
}
