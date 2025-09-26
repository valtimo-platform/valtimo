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

import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/config';
import {HttpClient} from '@angular/common/http';
import {Observable, Subject} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DownloadService {
  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {}

  downloadFile(url: string, name: string, forceDownload?: boolean): Observable<null> {
    const finishedSubject$ = new Subject<null>();

    if (
      url.startsWith(this.configService.config.valtimoApi.endpointUri) ||
      url.startsWith(window.location.origin) ||
      url.startsWith('/api/')
    ) {
      // if download url is on backend use angular to get the content so access token is used
      this.http.get(url, {responseType: 'blob'}).subscribe(content => {
        const downloadUrl = window.URL.createObjectURL(content);
        if (!this.isFileTypeSupportedForNewWindow(name) || forceDownload) {
          this.openDownloadLink(downloadUrl, name);
        } else {
          this.openBlobInNewTab(downloadUrl, name);
        }
        finishedSubject$.next(null);
      });
    } else {
      // download links to external services (like amazon s3) open in a new window
      this.openDownloadLink(url, name);
      finishedSubject$.next(null);
    }

    return finishedSubject$;
  }

  /**
   * A window.open won't work for blobs because ad blocker extensions will immediately
   * close the tab again. The method used below will prevent this from happening.
   */
  private openBlobInNewTab(url: string, name: string) {
    const newWindow = window.open('/');

    // newWindow will be null if the browser blocks the opening of a new tab.
    if (newWindow != null) {
      newWindow.location = url;
    } else {
      // In case the tab is blocked it will just download the file.
      this.openDownloadLink(url, name);
    }
  }

  private openDownloadLink(url: string, name: string) {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.target = '_blank';
    link.click();
    link.remove();
  }

  private isFileTypeSupportedForNewWindow(name: string): boolean {
    const supportedFileTypes = this.configService?.config
      ?.supportedDocumentFileTypesToViewInBrowser || ['pdf', 'jpg', 'png', 'svg'];

    return supportedFileTypes.some(function (suffix) {
      return name.toUpperCase().endsWith(suffix.toUpperCase());
    });
  }
}
