# Migration

This page describes how to update Valtimo from the previous version to the current.

* **Form flow submissionData type**

  Scope: back-end

  1. **Find submission data in form flow beans**

     Find all classes with the annotation `@FormFlowBean` and locate all methods use submission data in a parameter.
  2. **Change submission data type**

     Change the type of the submission data from a `String` to a `com.fasterxml.jackson.databind.JsonNode`.
