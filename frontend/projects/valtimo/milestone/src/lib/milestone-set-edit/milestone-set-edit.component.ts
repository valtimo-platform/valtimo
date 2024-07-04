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
import {ActivatedRoute, Router} from '@angular/router';
import {AlertService} from '@valtimo/components';
import {MilestoneSet} from '../models';

@Component({
  selector: 'valtimo-milestone-set-edit',
  templateUrl: './milestone-set-edit.component.html',
  styleUrls: ['./milestone-set-edit.component.scss'],
})
export class MilestoneSetEditComponent implements OnInit {
  public form: FormGroup;

  constructor(
    private milestoneService: MilestoneService,
    private formBuilder: FormBuilder,
    private router: Router,
    private alertService: AlertService,
    private route: ActivatedRoute
  ) {}

  get formControls() {
    return this.form.controls;
  }

  ngOnInit() {
    this.form = this.formBuilder.group({
      id: new FormControl({value: '', disabled: true}, Validators.required),
      title: new FormControl({}, Validators.required),
    });
    this.getMilestoneSet();
  }

  reset() {
    this.form.controls.title.setValue('');
  }

  getMilestoneSet() {
    const milestoneSetId = this.route.snapshot.paramMap.get('id');
    this.milestoneService
      .getMilestoneSet(+milestoneSetId)
      .subscribe((milestoneSet: MilestoneSet) => {
        this.form.setValue({
          id: milestoneSet.id,
          title: milestoneSet.title,
        });
      });
  }

  delete() {
    // Todo: add confirmation dialog after it's fixed
    this.deleteMilestoneSet();
  }

  deleteMilestoneSet() {
    this.milestoneService.deleteMilestoneSet(this.form.getRawValue().id).subscribe(
      () => {
        this.router.navigate(['/milestones']);
        this.alertService.success('Milestone set has been deleted');
      },
      err => {
        this.router.navigate(['/milestones']);
        this.alertService.error(
          'Could not delete Milestone set. Make sure this Milestone set does not contain any milestones.'
        );
      }
    );
  }

  updateMilestoneSet() {
    this.milestoneService.updateMilestoneSet(this.form.getRawValue()).subscribe(() => {
      this.router.navigate(['/milestones']);
      this.alertService.success('Milestone set has been updated');
    });
  }
}
