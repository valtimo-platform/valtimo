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
import {ExtensionListItem} from '../../models';
import {ExtensionService} from '../../services';
import {GlobalNotificationService} from '@valtimo/shared';

@Component({
  standalone: false,
  templateUrl: './extension-overview.component.html',
  styleUrls: ['./extension-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExtensionOverviewComponent implements OnInit {
  public readonly extensions$: BehaviorSubject<Array<ExtensionListItem>> = new BehaviorSubject([]);

  constructor(
    private readonly extensionService: ExtensionService,
    private readonly globalNotificationService: GlobalNotificationService
  ) {}

  public ngOnInit(): void {
    this.updateList();
  }

  public onClickInstall(extension): void {
    this.extensionService.installExtension(extension.id, extension.nextVersion).subscribe(
      _ => {
        this.extensionService.load(extension.id).subscribe(
          _ => {
            this.globalNotificationService.showToast({
              title: `Successfully installed extension '${extension.id}'`,
              type: 'success',
            });
          },
          err => {
            this.globalNotificationService.showToast({
              title: `Failed to install extension '${extension.id}'`,
              type: 'error',
            });
            this.uninstall(extension.id);
          }
        );
        this.updateList();
      },
      err => {
        this.globalNotificationService.showToast({
          title: `Failed to install extension '${extension.id}'`,
          type: 'error',
        });
      }
    );
  }

  public onClickUpdate(extension): void {
    this.extensionService.updateExtension(extension.id, extension.nextVersion).subscribe(
      _ => {
        this.extensionService.load(extension.id).subscribe(
          _ => {
            this.globalNotificationService.showToast({
              title: `Successfully updated extension '${extension.id}'`,
              type: 'success',
            });
          },
          err => {
            this.globalNotificationService.showToast({
              title: `Failed to update extension '${extension.id}'`,
              type: 'error',
            });
            this.uninstall(extension.id);
          }
        );
        this.updateList();
      },
      err => {
        this.globalNotificationService.showToast({
          title: `Failed to update extension '${extension.id}'`,
          type: 'error',
        });
      }
    );
  }

  public uninstall(extensionId: string): void {
    this.extensionService.uninstallExtension(extensionId).subscribe(_ => this.updateList());
  }

  private updateList(): void {
    this.extensionService
      .getExtensions()
      .subscribe(extensions => this.extensions$.next(extensions));
  }
}
