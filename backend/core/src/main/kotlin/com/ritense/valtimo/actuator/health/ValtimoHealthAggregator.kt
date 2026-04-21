package com.ritense.valtimo.actuator.health

import org.springframework.boot.health.actuate.endpoint.StatusAggregator
import org.springframework.boot.health.contributor.Status

class ValtimoHealthAggregator : StatusAggregator {
    override fun getAggregateStatus(statuses: Set<Status>): Status {
        if(statuses.stream().allMatch { s -> s.equals(Status.UP) }) return Status.UP
        if(statuses.stream().anyMatch { s -> s.equals(Status.DOWN) }) return Status.DOWN
        if(statuses.stream().anyMatch { s -> s.equals(Status.OUT_OF_SERVICE) }) return Status.OUT_OF_SERVICE
        return Status("RESTRICTED");
    }
}