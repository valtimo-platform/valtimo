import {PermissionRequest} from '../models';

const getPermissionRequestKey = (permissionRequest: PermissionRequest): string => {
  const input = JSON.stringify(permissionRequest);
  const len = input.length;

  let hash = 0;

  for (let i = 0; i < len; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // to 32bit integer
  }
  return `${hash}`;
};

export {getPermissionRequestKey};
