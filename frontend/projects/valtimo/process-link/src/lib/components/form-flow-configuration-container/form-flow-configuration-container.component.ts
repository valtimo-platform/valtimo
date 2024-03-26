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

import {
  Component,
  ComponentRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {BehaviorSubject, combineLatest, Subscription} from 'rxjs';
import {tap} from 'rxjs/operators';
import {ChangeEvent, FormFlowCustomComponent} from '../../models';
import {FormFlowComponentService} from '../../services';
import {FormioSubmission} from '@valtimo/components';

@Component({
  selector: 'valtimo-form-flow-configuration-container',
  templateUrl: './form-flow-configuration-container.component.html',
})
export class FormFlowConfigurationContainerComponent
  implements OnInit, OnDestroy, FormFlowCustomComponent
{
  @ViewChild('formFlowConfigurationComponent', {static: true, read: ViewContainerRef})
  private readonly _dynamicContainer: ViewContainerRef;
  @Input() public set disabled(disabledValue: boolean) {
    this._disabled$.next(disabledValue);
  }
  @Input() public set componentId(value: string) {
    this._componentId$.next(value);
  }
  @Input() public set formFlowInstanceId(value: string) {
    this._formFlowInstanceId$.next(value);
  }
  @Output() public changeEvent = new EventEmitter<ChangeEvent>();
  @Output() public submitEvent = new EventEmitter<FormioSubmission>();

  private _changeSubscription!: Subscription;
  private _submitSubscription!: Subscription;

  private readonly _subscriptions = new Subscription();
  private readonly _componentRef$ = new BehaviorSubject<
    ComponentRef<FormFlowCustomComponent> | undefined
  >(undefined);
  private readonly _disabled$ = new BehaviorSubject<boolean>(false);
  private readonly _componentId$ = new BehaviorSubject<string>('');
  private readonly _formFlowInstanceId$ = new BehaviorSubject<string>('');

  constructor(private readonly formFlowComponentService: FormFlowComponentService) {}

  public ngOnInit(): void {
    this.openConfigurationComponentSubscription();
    this.openComponentInstanceSubscription();
    this.openDisabledSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  private openConfigurationComponentSubscription(): void {
    this._subscriptions.add(
      combineLatest([this.formFlowComponentService.supportedComponents$, this._componentId$])
        .pipe(
          tap(([supportedComponents, componentId]) => {
            const configurationComponent = supportedComponents.find(
              component => component.id === componentId
            );

            this._dynamicContainer.clear();

            if (configurationComponent) {
              const componentRef = this._dynamicContainer.createComponent(
                configurationComponent.component
              );
              this._componentRef$.next(componentRef);
            }
          })
        )
        .subscribe()
    );
  }

  private openComponentInstanceSubscription(): void {
    this._subscriptions.add(
      combineLatest([this._componentRef$, this._formFlowInstanceId$]).subscribe(
        ([ref, formFlowInstanceId]) => {
          const instance = ref?.instance;

          this._submitSubscription?.unsubscribe();
          this._changeSubscription?.unsubscribe();

          if (instance) {
            if (formFlowInstanceId) {
              instance.formFlowInstanceId = formFlowInstanceId;
            }

            this._changeSubscription = instance.changeEvent.subscribe(change => {
              this.changeEvent.emit(change);
            });

            this._submitSubscription = instance.submitEvent.subscribe(submit => {
              this.submitEvent.emit(submit);
            });
          }
        }
      )
    );
  }

  private openDisabledSubscription(): void {
    this._subscriptions.add(
      combineLatest([this._componentRef$, this._disabled$]).subscribe(([ref, disabled]) => {
        const instance = ref?.instance;

        if (instance) {
          instance.disabled = disabled;
        }
      })
    );
  }
}
