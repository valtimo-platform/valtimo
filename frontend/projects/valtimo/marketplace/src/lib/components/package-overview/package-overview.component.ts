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
import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {PackageListItem} from '../../models';
import {PackageService} from '../../services';
import {GlobalNotificationService} from '@valtimo/shared';

@Component({
  standalone: false,
  templateUrl: './package-overview.component.html',
  styleUrls: ['./package-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PackageOverviewComponent implements OnInit {
  public readonly packages$: BehaviorSubject<Array<PackageListItem>> = new BehaviorSubject([]);

  constructor(
    private readonly packageService: PackageService,
    private readonly globalNotificationService: GlobalNotificationService
  ) {}

  public ngOnInit(): void {
    this.updateList();
  }

  public onClickInstall(pkg): void {
    this.packageService.installPackage(pkg.id, pkg.nextVersion).subscribe(
      _ => {
        this.packageService.load(pkg.id).subscribe(
          _ => {
            this.globalNotificationService.showToast({
              title: `Successfully installed package '${pkg.id}'`,
              type: 'success',
            });
          },
          err => {
            this.globalNotificationService.showToast({
              title: `Failed to install package '${pkg.id}'`,
              type: 'error',
            });
            this.uninstall(pkg.id);
          }
        );
        this.updateList();
      },
      err => {
        this.globalNotificationService.showToast({
          title: `Failed to install package '${pkg.id}'`,
          type: 'error',
        });
      }
    );
  }

  public onClickUpdate(pkg): void {
    this.packageService.updatePackage(pkg.id, pkg.nextVersion).subscribe(
      _ => {
        this.packageService.load(pkg.id).subscribe(
          _ => {
            this.globalNotificationService.showToast({
              title: `Successfully updated package '${pkg.id}'`,
              type: 'success',
            });
          },
          err => {
            this.globalNotificationService.showToast({
              title: `Failed to update package '${pkg.id}'`,
              type: 'error',
            });
            this.uninstall(pkg.id);
          }
        );
        this.updateList();
      },
      err => {
        this.globalNotificationService.showToast({
          title: `Failed to update package '${pkg.id}'`,
          type: 'error',
        });
      }
    );
  }

  public uninstall(packageId: string): void {
    this.packageService.uninstallPackage(packageId).subscribe(_ => this.updateList());
  }

  private updateList(): void {
    this.packageService
      .getPackages()
      .subscribe(packages => this.packages$.next(packages));
  }
}
