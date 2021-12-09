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

import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { TaskService } from '@valtimo/task';
import { ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Location } from '@angular/common';

@Component({
  selector: 'app-custom-form-example',
  templateUrl: './custom-form-example.component.html',
  styleUrls: ['./custom-form-example.component.scss']
})
export class CustomFormExampleComponent implements OnInit {
  public customForm: FormGroup;
  public task: any;
  public id: string;

  constructor(
    private route: ActivatedRoute,
    private taskService: TaskService,
    private formBuilder: FormBuilder,
    private toastr: ToastrService,
    private _location: Location
  ) {
    this.id = this.route.snapshot.paramMap.get('taskId');
  }

  ngOnInit() {
    this.getTask(this.id);
    this.customForm = this.createFormGroup();
  }

  public getTask(id) {
    this.taskService.getTask(id).subscribe(task => {
      this.task = task;
    });
  }

  private createFormGroup() {
    const group = this.formBuilder.group({
      inputText: new FormControl(''),
      inputPassword: new FormControl(''),
      inputPlaceholder: new FormControl(''),
      inputDisabled: new FormControl({value: '', disabled: true}),
      inputReadonly: new FormControl('Readonly input text'),
      inputTextarea: new FormControl('')
    });
    return group;
  }

  public reset() {
    this.customForm = this.createFormGroup();
  }

  public onSubmit() {
    this.taskService.completeTask(this.id, this.customForm.value).subscribe(() => {
      this.toastr.success(this.task.task.name + ' has successfully been completed');
      this._location.back();
    });
  }
}
