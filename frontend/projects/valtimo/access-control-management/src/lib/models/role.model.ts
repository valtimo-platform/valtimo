interface Role {
  roleKey: string;
}

interface DeleteRolesRequest {
  roles: Array<string>;
}

type RoleMetadataModal = 'add' | 'edit';

export {Role, DeleteRolesRequest, RoleMetadataModal};
