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

import {Injectable, OnDestroy} from '@angular/core';
import {NGXLogger} from 'ngx-logger';
import {BehaviorSubject, Observable, Subject, Subscription} from 'rxjs';
import {
  InstallFlowStep,
  PackageJob,
  PackageJobStatus,
  PackageListItem,
  PackageOperation,
  PackagePreflight,
} from '../models';
import {PackageService} from './package.service';

/**
 * Drives one package operation from review to outcome.
 *
 * The point of the review step is that an install is not always reversible — a config
 * package cannot be uninstalled — so the backend's preflight verdict is shown, and its
 * blockers prevent confirmation, before anything is applied. After confirmation the
 * operation is a background job, so this follows the job rather than a request.
 */
@Injectable()
export class PackageOperationService implements OnDestroy {
  private readonly _visible$ = new BehaviorSubject<boolean>(false);
  private readonly _step$ = new BehaviorSubject<InstallFlowStep>(InstallFlowStep.REVIEW);
  private readonly _operation$ = new BehaviorSubject<PackageOperation>(PackageOperation.INSTALL);
  private readonly _package$ = new BehaviorSubject<PackageListItem | null>(null);
  private readonly _preflight$ = new BehaviorSubject<PackagePreflight | null>(null);
  private readonly _preflightLoading$ = new BehaviorSubject<boolean>(false);
  private readonly _preflightError$ = new BehaviorSubject<string | null>(null);
  private readonly _job$ = new BehaviorSubject<PackageJob | null>(null);
  private readonly _requestedVersion$ = new BehaviorSubject<string | undefined>(undefined);

  public readonly visible$: Observable<boolean> = this._visible$.asObservable();
  public readonly step$: Observable<InstallFlowStep> = this._step$.asObservable();
  public readonly operation$: Observable<PackageOperation> = this._operation$.asObservable();
  public readonly package$: Observable<PackageListItem | null> = this._package$.asObservable();
  public readonly preflight$: Observable<PackagePreflight | null> = this._preflight$.asObservable();
  public readonly preflightLoading$: Observable<boolean> = this._preflightLoading$.asObservable();
  public readonly preflightError$: Observable<string | null> = this._preflightError$.asObservable();
  public readonly job$: Observable<PackageJob | null> = this._job$.asObservable();

  /** Emits once per finished operation, so the page can reload the catalogue. */
  public readonly finished$ = new Subject<PackageJob>();

  private _pollSubscription?: Subscription;

  constructor(
    private readonly packageService: PackageService,
    private readonly logger: NGXLogger
  ) {}

  public ngOnDestroy(): void {
    this._pollSubscription?.unsubscribe();
  }

  public startInstall(pkg: PackageListItem, version?: string): void {
    this.start(pkg, PackageOperation.INSTALL, version);
  }

  public startUpdate(pkg: PackageListItem, version?: string): void {
    this.start(pkg, PackageOperation.UPDATE, version ?? pkg.nextVersion);
  }

  /**
   * Uninstall has no preflight: there is nothing to download or check compatibility for,
   * so the review step is a plain confirmation.
   */
  public startUninstall(pkg: PackageListItem): void {
    this.reset();
    this._package$.next(pkg);
    this._operation$.next(PackageOperation.UNINSTALL);
    this._step$.next(InstallFlowStep.REVIEW);
    this._visible$.next(true);
  }

  public confirm(): void {
    const pkg = this._package$.getValue();
    if (!pkg) return;

    const operation = this._operation$.getValue();
    const version =
      this._preflight$.getValue()?.targetVersion ?? this._requestedVersion$.getValue();

    const request$ =
      operation === PackageOperation.UNINSTALL
        ? this.packageService.uninstallPackage(pkg.id)
        : operation === PackageOperation.UPDATE
          ? this.packageService.updatePackage(pkg.id, version as string)
          : this.packageService.installPackage(pkg.id, version as string);

    this._step$.next(InstallFlowStep.PROGRESS);
    request$.subscribe({
      next: job => this.follow(job),
      error: error => {
        this.logger.error(`Could not start ${operation} of package '${pkg.id}'.`, error);
        // The submit itself failed, so there is no job to poll. Surfaced on the result
        // step rather than as a toast, because the modal is still open in front of it.
        this._job$.next(null);
        this._step$.next(InstallFlowStep.RESULT);
      },
    });
  }

  public close(): void {
    this._visible$.next(false);
    this._pollSubscription?.unsubscribe();
  }

  private start(pkg: PackageListItem, operation: PackageOperation, version?: string): void {
    this.reset();
    this._package$.next(pkg);
    this._operation$.next(operation);
    this._requestedVersion$.next(version);
    this._step$.next(InstallFlowStep.REVIEW);
    this._visible$.next(true);
    this.loadPreflight(pkg, version);
  }

  private loadPreflight(pkg: PackageListItem, version?: string): void {
    this._preflightLoading$.next(true);
    this.packageService.preflight(pkg.id, version).subscribe({
      next: preflight => {
        this._preflight$.next(preflight);
        this._preflightLoading$.next(false);
      },
      error: error => {
        this.logger.error(`Could not run preflight for package '${pkg.id}'.`, error);
        // Without a verdict the operation is not offered: proceeding blind is exactly what
        // the review step exists to prevent.
        this._preflightError$.next(error?.error?.detail ?? error?.message ?? 'unknown');
        this._preflightLoading$.next(false);
      },
    });
  }

  private follow(job: PackageJob): void {
    this._job$.next(job);
    this._pollSubscription?.unsubscribe();
    this._pollSubscription = this.packageService.pollJob(job.id).subscribe({
      next: polled => {
        this._job$.next(polled);
        if (
          polled.status === PackageJobStatus.SUCCEEDED ||
          polled.status === PackageJobStatus.FAILED
        ) {
          this._step$.next(InstallFlowStep.RESULT);
          this.finished$.next(polled);
        }
      },
      error: error => {
        this.logger.error(`Lost track of package job '${job.id}'.`, error);
        this._step$.next(InstallFlowStep.RESULT);
      },
    });
  }

  private reset(): void {
    this._pollSubscription?.unsubscribe();
    this._preflight$.next(null);
    this._preflightError$.next(null);
    this._job$.next(null);
    this._requestedVersion$.next(undefined);
  }
}
