enum UPLOAD_STATUS {
  ACTIVE = 'active',
  ERROR = 'error',
  FINISHED = 'finished',
}

enum UPLOAD_STEP {
  ACCESS_CONTROL = 'accessControl',
  DASHBOARD = 'dashboard',
  FILE_SELECT = 'fileSelect',
  FILE_UPLOAD = 'fileUpload',
  PLUGINS = 'plugins',
}

const STEPS = [
  UPLOAD_STEP.PLUGINS,
  UPLOAD_STEP.FILE_SELECT,
  UPLOAD_STEP.FILE_UPLOAD,
  UPLOAD_STEP.ACCESS_CONTROL,
  UPLOAD_STEP.DASHBOARD,
];

export {STEPS, UPLOAD_STATUS, UPLOAD_STEP};
