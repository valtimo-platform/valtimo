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

import {firstValueFrom} from 'rxjs';
import {BuildingBlockManagementService} from './building-block-management.service';

describe('BuildingBlockManagementService upload modal', () => {
  it('emits the preset file and resets it when the modal is hidden', async () => {
    const service = new BuildingBlockManagementService();
    const file = new File(['x'], 'bb.zip');

    service.showUploadModal(file);
    expect(await firstValueFrom(service.presetUploadFile$)).toBe(file);
    expect(await firstValueFrom(service.showUploadModal$)).toBeTrue();

    service.hideUploadModal();
    expect(await firstValueFrom(service.presetUploadFile$)).toBeNull();
    expect(await firstValueFrom(service.showUploadModal$)).toBeFalse();
  });

  it('has no preset file when shown without one', async () => {
    const service = new BuildingBlockManagementService();

    service.showUploadModal();

    expect(await firstValueFrom(service.presetUploadFile$)).toBeNull();
  });
});
