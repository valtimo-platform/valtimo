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
import {Milestone, MilestoneSet} from '../models';
import {MilestoneService} from '../milestone.service';
import {ActivatedRoute, Router} from '@angular/router';
import {AlertService} from '@valtimo/components';
import {ProcessService, ProcessDefinition} from '@valtimo/process';
import {switchMap} from 'rxjs/operators';

@Component({
  selector: 'valtimo-milestone-edit',
  templateUrl: './milestone-edit.component.html',
  styleUrls: ['./milestone-edit.component.scss'],
})
export class MilestoneEditComponent implements OnInit {
  public form: FormGroup;
  public milestoneSets: MilestoneSet[] = [];
  public processDefinitions: ProcessDefinition[] = [];
  public taskDefinitions: any[] = [];

  constructor(
    private milestoneService: MilestoneService,
    private formBuilder: FormBuilder,
    private router: Router,
    private alertService: AlertService,
    private processService: ProcessService,
    private route: ActivatedRoute
  ) {}

  get formControls() {
    return this.form.controls;
  }

  ngOnInit() {
    this.form = this.formBuilder.group({
      id: new FormControl({value: '', disabled: true}, Validators.required),
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
    this.getMilestone();
    this.getMilestoneSets();
    this.getProcessDefinitions();
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

  getMilestone() {
    const milestoneId = this.route.snapshot.paramMap.get('id');
    this.milestoneService
      .getMilestone(+milestoneId)
      .pipe(
        switchMap((milestone: Milestone) => {
          this.form.patchValue({
            id: milestone.id,
            milestoneSet: milestone.milestoneSet.id,
            title: milestone.title,
            plannedIntervalInDays: milestone.plannedIntervalInDays,
            color: milestone.color,
            taskDefinitionKey: milestone.taskDefinitionKey,
          });
          return this.processService.getProcessDefinition(milestone.processDefinitionKey);
        })
      )
      .subscribe((processDefinition: ProcessDefinition) => {
        this.form.patchValue({
          processDefinitionKey: processDefinition,
        });
      });
  }

  compareProcessDefinitions(
    processDefinition1: ProcessDefinition,
    processDefinition2: ProcessDefinition
  ) {
    return processDefinition1.id === processDefinition2.id;
  }

  getMilestoneSets() {
    this.milestoneService.getMilestoneSets().subscribe((milesetoneSets: MilestoneSet[]) => {
      this.milestoneSets = milesetoneSets;
    });
  }

  getProcessDefinitions() {
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
      });
    }
  }

  delete() {
    // Todo: add confirmation dialog after it's fixed
    this.deleteMilestone();
  }

  deleteMilestone() {
    this.milestoneService.deleteMilestone(this.form.getRawValue().id).subscribe(
      () => {
        this.router.navigate(['/milestones']);
        this.alertService.success('Milestone has been deleted');
      },
      err => {
        this.router.navigate(['/milestones']);
        this.alertService.error('Could not delete Milestone');
      }
    );
  }

  updateMilestone() {
    const milestone: Milestone = this.form.getRawValue();
    milestone.processDefinitionKey = milestone.processDefinitionKey['key'];
    this.milestoneService.updateMilestone(milestone).subscribe(
      () => {
        this.router.navigate(['/milestones']);
        this.alertService.success('Milestone has been updated');
      },
      err => {
        this.alertService.error('Error updating milestone');
      }
    );
  }
}
