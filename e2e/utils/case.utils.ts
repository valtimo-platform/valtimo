import path from 'path';
import * as ApiUtils from './api.utils';
import * as fs from 'fs';

//Gives unauthorized
export abstract class CaseManagementUtils {
  public static async importCase(fileName: string) {
    const filePath = path.resolve(__dirname, `../assets/case-import-archives/${fileName}.zip`);
    const buffer = fs.readFileSync(filePath);
    await ApiUtils.apiPost('/api/management/v1/case/import', {
      multipart: {
        file: {
          name: `${fileName}.zip`,
          mimeType: 'application/zip',
          buffer,
        },
      },
    });
  }
}
