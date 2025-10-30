package com.ritense.valtimo.contract

interface VersionedIdentifier {
    fun getTagPrefix(): String
    override fun toString(): String
}