import {Injectable} from '@angular/core';
import {ConnectorInstance, Page, UserSettings, ValtimoConfig} from '../models';
import {HttpClient} from '@angular/common/http';
import {ConfigService} from './config.service';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UserSettingsService {
  private readonly valtimoApiUri!: string;

  constructor(private readonly http: HttpClient, private readonly configService: ConfigService) {
    this.valtimoApiUri = configService?.config?.valtimoApi?.endpointUri;
  }

  getUserSettings(): Observable<UserSettings> {
    return this.http.get<UserSettings>(`${this.valtimoApiUri}v1/user/settings`);
  }

  saveUserSettings(settings: UserSettings): Observable<any> {
    return this.http.put(`${this.valtimoApiUri}v1/user/settings`, settings);
  }
}
