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

import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/config';
import {HttpClient} from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class DownloadService {

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) { }

  downloadFile(url: string, name: string) {
    if (url.startsWith(this.configService.config.valtimoApi.endpointUri) || url.startsWith(window.location.origin)) {
      // if download url is on backend use angular to get the content so access token is used
      this.http.get(url, {responseType: 'blob'}).subscribe(content => {
        const downloadUrl = window.URL.createObjectURL(content);
        this.openDownloadLink(downloadUrl, name);
      });
    } else {
      // download links to external services (like amazon s3) open in a new window
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
}
