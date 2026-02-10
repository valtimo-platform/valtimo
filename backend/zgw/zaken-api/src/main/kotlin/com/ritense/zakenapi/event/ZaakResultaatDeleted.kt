package com.ritense.zakenapi.event

import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.outbox.domain.BaseEvent

class ZaakResultaatDeleted (zaakResultaatId: String) : BaseEvent(
    type = "com.ritense.gzac.zrc.zaakresultaat.deleted",
    resultType = "com.ritense.zakenapi.domain.DeleteZaakResultaatResponse",
    resultId = zaakResultaatId,
    result = null
)