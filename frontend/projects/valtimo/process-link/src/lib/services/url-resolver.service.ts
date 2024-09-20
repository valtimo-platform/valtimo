import {Injectable} from '@angular/core';

@Injectable()
export class UrlResolverService {

  public resolveUrlVariables(url: string, variables: Map<string, string>): string {
    let resolvingUrl = url;
    Object.keys(variables).forEach(key => {
      let value = variables[key];
      resolvingUrl = resolvingUrl.replace('<' + key + '>', value);
    });
    return resolvingUrl;
  }

}
