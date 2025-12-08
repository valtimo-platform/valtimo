# 13.0.1

## Bugfixes

* When deploying a decision definition that is not part of a case definition, it now no longer replaces the previous 
version but instead adds a new one.
* When creating a new case definition now the default case tabs are again automatically created.
* Fixed a bug where plugin actions would sometimes not be available from the process link screen.
* Process links for global processes are now correctly imported again when import files are located in the 
`config/global/process-link` folder.
* The application no longer breaks when CASE_MANAGEMENT_TAB_TOKEN is not provided. The token is now injected optionally, ensuring stability even when it is missing.
* Candidate users were not always shown when trying to assign them to a task.
