export {
  ZGW_LINK_UPLOAD_PROCESS_TEST_IDS,
  ZGW_DOCUMENT_COLUMNS_TEST_IDS,
  ZGW_UPLOAD_FIELDS_TEST_IDS,
  ZGW_CASE_SYNC_TEST_IDS,
  ZGW_CASE_TYPE_LINK_TEST_IDS,
  ZGW_KEYWORDS_TEST_IDS,
} from '../../frontend/projects/valtimo/zgw/src/lib/constants/zgw.test-ids';

// Import directly from the constants file — importing from public-api pulls in
// Angular component code that Node cannot parse at test runtime.
export {TASK_LIST_TEST_IDS} from '../../frontend/projects/valtimo/task/src/lib/constants/task-list.test-ids';
