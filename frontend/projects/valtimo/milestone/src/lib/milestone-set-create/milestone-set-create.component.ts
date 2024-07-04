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
import {MilestoneService} from '../milestone.service';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {AlertService} from '@valtimo/components';
import {Router} from '@angular/router';

@Component({
  selector: 'valtimo-milestone-set-create',
  templateUrl: './milestone-set-create.component.html',
  styleUrls: ['./milestone-set-create.component.scss'],
})
export class MilestoneSetCreateComponent implements OnInit {
  public form: FormGroup;

  constructor(
    private milestoneService: MilestoneService,
    private formBuilder: FormBuilder,
    private router: Router,
    private alertService: AlertService
  ) {}

  get formControls() {
    return this.form.controls;
  }

  ngOnInit() {
    this.form = this.formBuilder.group({
      title: new FormControl('', Validators.required),
    });
  }

  reset() {
    this.form.setValue({
      title: '',
    });
  }

  createMilestoneSet() {
    this.milestoneService.createMilestoneSet(this.form.value).subscribe(() => {
      this.router.navigate(['/milestones']);
      this.alertService.success('New Milestone set has been created');
    });
  }
}
