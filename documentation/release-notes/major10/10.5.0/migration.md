# Migration

This page describes how to update Valtimo from the previous version to the current.

*   **Migrate from process 'Retrieve Document and link to Zaak' to task 'Link document to zaak'**

    Scope: front-end

    1.  **Go to 'Process links' menu**

        Under the 'Admin' menu, go to the 'Process links' menu.
    2. **Select process 'Retrieve Document and link to Zaak'**
    3.  **Check task 'Link Document to Zaak'**

        Click the service task 'Link Document to Zaak' and write down all properties of the process link. If no process link is configured, migrating is not necessary.
    4. **Select the process 'Process completed Portaaltaak'**
    5.  **Configure task 'Link Document to Zaak'**

        Click the service task 'Link Document to Zaak' and configure the process link as was written down.
    6.  **Delete process 'Retrieve Document and link to Zaak'**

        (Optional) You may now delete the process 'Retrieve Document and link to Zaak'. Unfortunately, Valtimo doesn't provide a simple way of deleting a process definition.
