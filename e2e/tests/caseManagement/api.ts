/** Case Management API Utilities */
import { smartStep } from '../../../utils/smartStep';
import { apiDelete, apiGet, apiPost } from '../../../utils/api.utils';
import { endpoints } from '../../../api/endpoints';

export class CaseManagementApi {
  /** Create a case definition via API */
  async create(key: string, opts?: { description?: string }) {
    return smartStep('case', 'create', 'API', async () => {
      const body = {
        caseDefinitionKey: key,
        caseDefinitionVersion: '0.0.1',
        name: key,
        ...(opts?.description && { description: opts.description }),
      };
      return await apiPost(endpoints.caseDefinition.create, body);
    });
  }

  /** Get case definition details via API */
  async get(key: string) {
    return smartStep('case', 'fetch details', 'API', async () => {
      return apiGet(endpoints.caseDefinition.getByKeyAndVersion(key));
    });
  }

  /** Delete case definition via API */
  async delete(key: string) {
    return smartStep('case', 'delete', 'API', async () => {
      return apiDelete(endpoints.caseDefinition.delete(key));
    });
  }
}

// Export a singleton for convenience
export const caseManagementApi = new CaseManagementApi();
