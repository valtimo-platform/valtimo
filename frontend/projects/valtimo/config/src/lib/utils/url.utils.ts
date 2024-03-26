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

class UrlUtils {
  static formatUrlTrailingSlash(url: string, returnWithTrailingSlash: boolean): string {
    if (url && typeof url === 'string') {
      const urlLastCharacter = url[url.length - 1];
      const urlLastCharacterIsSlash = urlLastCharacter === '/';

      if (!returnWithTrailingSlash && urlLastCharacterIsSlash) {
        return url.slice(0, -1);
      } else if (returnWithTrailingSlash && !urlLastCharacterIsSlash) {
        return `${url}/`;
      }
    }

    return url;
  }

  static getUrlHost(urlString: string): string {
    let url!: URL;

    try {
      url = new URL(urlString);
    } catch (_) {}

    return url ? url.host : '';
  }
}

export {UrlUtils};
