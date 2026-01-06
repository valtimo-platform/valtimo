# 13.1.1

## Bugfixes

* Fixed an issue where changesets could fail to run on application startup because the pre-run changes were not
  commited to the database. This generally lead to the application failing to start with a "Key (key)=(ROLE_USER) already
  exists." error.
* On starting the application Camunda web-app roles are now also migrated to the corresponding Operaton web-app roles.
* When migrating Valtimo 12 process definitions, the application will no longer break on process definitions that do 
not have a name.
