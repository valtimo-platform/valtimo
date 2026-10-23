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

import {ComponentFixture, TestBed} from '@angular/core/testing';
import {SimpleChange} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {TranslateModule} from '@ngx-translate/core';
import {of, throwError} from 'rxjs';
import {ExternalPluginContractJobDetail, ExternalPluginService} from '@valtimo/plugin';
import {PluginContractJobDetailModalComponent} from './plugin-contract-job-detail-modal.component';
import {PLUGIN_CONTRACT_JOB_DETAIL_MODAL_TEST_IDS} from '../../constants';

describe('PluginContractJobDetailModalComponent', () => {
  let fixture: ComponentFixture<PluginContractJobDetailModalComponent>;
  let component: PluginContractJobDetailModalComponent;
  let externalPluginService: jasmine.SpyObj<ExternalPluginService>;
  let changes = 0;

  const job = (
    overrides: Partial<ExternalPluginContractJobDetail> = {}
  ): ExternalPluginContractJobDetail => ({
    id: 'job-1',
    contract: 'nl.ritense.openplan@1',
    operation: 'export',
    requesterConfigurationId: 'requester-id',
    requesterTitle: 'PDCA',
    requesterPluginId: 'pdca',
    providerConfigurationId: 'provider-id',
    providerTitle: 'Open Plan',
    providerPluginId: 'openplan',
    status: 'PENDING',
    requestedBy: 'admin',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: null,
    completedAt: null,
    deliveredAt: null,
    deadline: null,
    deliveryAttempts: 0,
    errorCode: null,
    providerErrorCode: null,
    errorMessage: null,
    documentId: 'document-id',
    outcome: null,
    idempotencyKey: 'export-42',
    replyToProcessInstanceId: null,
    lastDeliveryError: null,
    ...overrides,
  });

  const open = (detail: ExternalPluginContractJobDetail = job()): void => {
    externalPluginService.getContractJob.and.returnValue(of(detail));
    component.jobId = detail.id;
    component.open = true;
    component.ngOnChanges({
      open: new SimpleChange(false, true, true),
      jobId: new SimpleChange(null, detail.id, true),
    });
  };

  beforeEach(() => {
    externalPluginService = jasmine.createSpyObj<ExternalPluginService>('ExternalPluginService', [
      'getContractJob',
      'getContractJobPayload',
      'cancelContractJob',
      'redeliverContractJob',
    ]);
    externalPluginService.getContractJobPayload.and.returnValue(
      of({requestPayload: {planId: 7}, resultPayload: null})
    );

    TestBed.configureTestingModule({
      imports: [PluginContractJobDetailModalComponent, TranslateModule.forRoot()],
      providers: [{provide: ExternalPluginService, useValue: externalPluginService}],
    });
    TestBed.overrideComponent(PluginContractJobDetailModalComponent, {
      set: {template: '', styles: []},
    });

    fixture = TestBed.createComponent(PluginContractJobDetailModalComponent);
    component = fixture.componentInstance;
    changes = 0;
    component.jobChangedEvent.subscribe(() => changes++);
  });

  describe('payloads', () => {
    it('stay hidden until the admin asks for them', () => {
      open();

      expect(component.$payloadState()).toBe('hidden');
      expect(externalPluginService.getContractJobPayload).not.toHaveBeenCalled();

      component.onShowPayloads();

      expect(externalPluginService.getContractJobPayload).toHaveBeenCalledWith('job-1');
      expect(component.$payloadState()).toBe('shown');
      expect(component.$requestPayloadJson()).toBe(JSON.stringify({planId: 7}, null, 2));
      expect(component.$resultPayloadJson()).toBe('');
    });

    it('are forgotten on close', () => {
      open();
      component.onShowPayloads();
      let closed = false;
      component.closeEvent.subscribe(() => (closed = true));

      component.onClose();

      expect(closed).toBeTrue();
      expect(component.$payloadState()).toBe('hidden');
      expect(component.$requestPayloadJson()).toBe('');
    });

    it('report a failed read', () => {
      open();
      externalPluginService.getContractJobPayload.and.returnValue(
        throwError(() => new HttpErrorResponse({status: 500}))
      );

      component.onShowPayloads();

      expect(component.$payloadState()).toBe('error');
    });
  });

  describe('actions', () => {
    it('offers cancel while the job is open or its reply undelivered', () => {
      open(job({status: 'ACCEPTED'}));
      expect(component.$canCancel()).toBeTrue();
      expect(component.$cancelStopsDelivery()).toBeFalse();

      open(job({status: 'EXPIRED'}));
      expect(component.$canCancel()).toBeTrue();
      expect(component.$cancelStopsDelivery()).toBeTrue();

      open(job({status: 'DELIVERED', outcome: 'COMPLETED'}));
      expect(component.$canCancel()).toBeFalse();
      expect(component.$canRedeliver()).toBeFalse();
    });

    it('offers redelivery for an undeliverable reply with an outcome', () => {
      open(job({status: 'UNDELIVERABLE', outcome: 'FAILED'}));
      expect(component.$canRedeliver()).toBeTrue();
      expect(component.$canCancel()).toBeFalse();

      open(job({status: 'UNDELIVERABLE', outcome: null}));
      expect(component.$canRedeliver()).toBeFalse();
    });

    it('cancels an open job after confirmation', () => {
      open();
      const cancelled = job({
        status: 'FAILED',
        outcome: 'FAILED',
        errorCode: 'CONTRACT_JOB_CANCELLED',
      });
      externalPluginService.cancelContractJob.and.returnValue(of(cancelled));

      component.onCancelJob();

      expect(component.confirmationOpen$.value).toBeTrue();
      expect(component.$confirmation().titleKey).toBe(
        'pluginManagement.contractJobs.confirmCancelJob.title'
      );
      expect(externalPluginService.cancelContractJob).not.toHaveBeenCalled();

      component.onActionConfirmed();

      expect(externalPluginService.cancelContractJob).toHaveBeenCalledWith('job-1');
      expect(component.$job()).toEqual(cancelled);
      expect(changes).toBe(1);
    });

    it('explains that cancelling a finished job stops its reply delivery', () => {
      open(job({status: 'COMPLETED', outcome: 'COMPLETED'}));

      component.onCancelJob();

      expect(component.$confirmation().titleKey).toBe(
        'pluginManagement.contractJobs.confirmStopDelivery.title'
      );
    });

    it('redelivers after confirmation', () => {
      open(job({status: 'UNDELIVERABLE', outcome: 'COMPLETED'}));
      externalPluginService.redeliverContractJob.and.returnValue(
        of(job({status: 'COMPLETED', outcome: 'COMPLETED'}))
      );

      component.onRedeliver();
      expect(component.$confirmation().titleKey).toBe(
        'pluginManagement.contractJobs.confirmRedeliver.title'
      );

      component.onActionConfirmed();

      expect(externalPluginService.redeliverContractJob).toHaveBeenCalledWith('job-1');
      expect(changes).toBe(1);
    });

    it('does nothing when the confirmation is dismissed', () => {
      open();

      component.onCancelJob();
      component.onActionDismissed();
      component.onActionConfirmed();

      expect(externalPluginService.cancelContractJob).not.toHaveBeenCalled();
    });

    it('explains a refused action and shows the current state', () => {
      open();
      externalPluginService.cancelContractJob.and.returnValue(
        throwError(() => new HttpErrorResponse({status: 409}))
      );
      externalPluginService.getContractJob.and.returnValue(of(job({status: 'DELIVERED'})));

      component.onCancelJob();
      component.onActionConfirmed();

      expect(component.$actionErrorKey()).toBe('pluginManagement.contractJobs.actionRefused');
      expect(component.$job()?.status).toBe('DELIVERED');
      expect(changes).toBe(1);
    });
  });

  describe('loading', () => {
    it('shows a missing job instead of an empty modal', () => {
      externalPluginService.getContractJob.and.returnValue(
        throwError(() => new HttpErrorResponse({status: 404}))
      );
      component.jobId = 'gone';
      component.open = true;
      component.ngOnChanges({open: new SimpleChange(false, true, true)});

      expect(component.$job()).toBeNull();
      expect(component.$loading()).toBeFalse();
      expect(component.$loadErrorKey()).toBe('pluginManagement.contractJobs.notFound');
    });

    it('can retry a failed load', () => {
      externalPluginService.getContractJob.and.returnValue(
        throwError(() => new HttpErrorResponse({status: 500}))
      );
      component.jobId = 'job-1';
      component.open = true;
      component.ngOnChanges({open: new SimpleChange(false, true, true)});
      expect(component.$loadErrorKey()).toBe('pluginManagement.contractJobs.loadFailed');

      externalPluginService.getContractJob.and.returnValue(of(job()));
      component.onRetry();

      expect(component.$loadErrorKey()).toBeNull();
      expect(component.$job()?.id).toBe('job-1');
    });
  });
});

describe('PluginContractJobDetailModalComponent template', () => {
  let fixture: ComponentFixture<PluginContractJobDetailModalComponent>;
  let externalPluginService: jasmine.SpyObj<ExternalPluginService>;

  const byTestId = (testId: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-test-id="${testId}"]`);

  beforeEach(() => {
    externalPluginService = jasmine.createSpyObj<ExternalPluginService>('ExternalPluginService', [
      'getContractJob',
      'getContractJobPayload',
    ]);
    externalPluginService.getContractJob.and.returnValue(
      of({
        id: 'job-1',
        contract: 'nl.ritense.openplan@1',
        operation: 'export',
        status: 'COMPLETED',
        outcome: 'COMPLETED',
        providerErrorCode: 'OPENPLAN_DOWN',
        createdAt: '2026-10-01T00:00:00Z',
        deliveryAttempts: 2,
      } as ExternalPluginContractJobDetail)
    );
    externalPluginService.getContractJobPayload.and.returnValue(
      of({requestPayload: {planId: 7}, resultPayload: {exported: true}})
    );

    TestBed.configureTestingModule({
      imports: [PluginContractJobDetailModalComponent, TranslateModule.forRoot()],
      providers: [{provide: ExternalPluginService, useValue: externalPluginService}],
    });

    fixture = TestBed.createComponent(PluginContractJobDetailModalComponent);
    fixture.componentRef.setInput('jobId', 'job-1');
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('shows payloads only after the admin asks for them', () => {
    expect(byTestId(PLUGIN_CONTRACT_JOB_DETAIL_MODAL_TEST_IDS.requestPayload)).toBeNull();

    byTestId(PLUGIN_CONTRACT_JOB_DETAIL_MODAL_TEST_IDS.showPayloadsButton)!.click();
    fixture.detectChanges();

    expect(
      byTestId(PLUGIN_CONTRACT_JOB_DETAIL_MODAL_TEST_IDS.requestPayload)?.textContent
    ).toContain('"planId": 7');
  });

  it('offers to stop delivering the reply of a finished job, not to redeliver it', () => {
    expect(byTestId(PLUGIN_CONTRACT_JOB_DETAIL_MODAL_TEST_IDS.cancelButton)?.textContent).toContain(
      'pluginManagement.contractJobs.actions.stopDelivery'
    );
    expect(byTestId(PLUGIN_CONTRACT_JOB_DETAIL_MODAL_TEST_IDS.redeliverButton)).toBeNull();
  });
});
