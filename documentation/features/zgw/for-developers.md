---
icon: laptop-code
---

# For developers

{% hint style="info" %}
The for developers section within each feature gives more tech heavy information of configuring, extending or altering Valtimo via the codebase.
{% endhint %}

<details>

<summary>Zaak lifecycle events and usage</summary>

#### Zaak lifecycle events (since 12.14.2)

* The Zaken API communicates Zaak lifecycle events as Spring Application Events. It concerns the following Zaak lifecycle events:
    * DocumentLinkedToZaak
    * ZaakRolCreated
    * ZaakRolUpdated
    * ZaakCreated
    * ZaakPatched
    * ZaakStatusCreated
    * ZaakResultaatCreated
    * ZaakOpschortingUpdated
    * ZaakeigenschapCreated
    * ZaakeigenschapUpdated
    * ZaakeigenschapDeleted
    * ZaakObjectCreated

#### Usage

The events can be received using the EventListener annotation.

```kotlin
//component handling ZaakEvent
@Component
class ZaakEventHandler {

    @EventListener
    fun handleZaakCreated(event: ZaakCreated) {
        logger.info("Received ZaakCreated event: ${event.zaakId}")

        // Process the event
        processNewZaak(event)

    }
}
```

</details>
