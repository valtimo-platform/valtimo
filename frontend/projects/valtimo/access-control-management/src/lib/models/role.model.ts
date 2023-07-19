interface Role {
  roleKey: string;
}

interface DeleteRolesRequest {
  roles: Array<string>;
}

export {Role, DeleteRolesRequest};
