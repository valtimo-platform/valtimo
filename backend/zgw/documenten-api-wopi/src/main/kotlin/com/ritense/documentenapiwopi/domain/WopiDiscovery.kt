/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.ritense.documentenapiwopi.domain

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlElementWrapper
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlProperty
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlRootElement

/**
 * Represents the WOPI discovery configuration used to retrieve and interpret the WOPI discovery
 * XML document, which provides details about the WOPI capabilities, endpoints, and supported
 * actions for integration with WOPI clients.
 *
 * The WOPI discovery process is essential for enabling seamless communication between the
 * WOPI server and clients, such as Office Online or other compatible applications.
 */
@JacksonXmlRootElement(localName = "wopi-discovery")
@JsonIgnoreProperties("proof-key")
data class WopiDiscovery(
    @param:JacksonXmlProperty(localName = "net-zone")
    val netZone: NetZone)

/**
 * Represents a network zone within the WOPI discovery configuration, which defines the network
 * zone and associated applications and actions.
 */
data class NetZone(
    @param:JacksonXmlProperty(isAttribute = true, localName = "name")
    val name: String,
    @param:JacksonXmlElementWrapper(useWrapping = false)
    @param:JacksonXmlProperty(localName = "app")
    val apps: List<App>)

/**
 * Represents an application within a network zone, which defines the application name, actions,
 * and optional favicon URL.
 */
@JsonIgnoreProperties("bootstrapperUrl", "appBootstrapperUrl", "applicationBaseUrl", "staticResourceOrigin", "checkLicense")
data class App(
    @param:JacksonXmlProperty(isAttribute = true, localName = "name")
    val name: String,
    @param:JacksonXmlElementWrapper(useWrapping = false)
    @param:JacksonXmlProperty(localName = "action")
    val actions: List<Action>? = emptyList(),
    @param:JacksonXmlProperty(isAttribute = true, localName = "favIconUrl")
    val favIconUrl: String?)

/**
 * Represents an action within an application, which defines the action name, URL source, default
 * status, and optional file extension.
 */
data class Action(
    @param:JacksonXmlProperty(isAttribute = true, localName = "name")
    val name: String,
    @param:JacksonXmlProperty(isAttribute = true, localName = "urlsrc")
    val urlSrc: String,
    @param:JacksonXmlProperty(isAttribute = true, localName = "default")
    val default: Boolean = false,
    @param:JacksonXmlProperty(isAttribute = true, localName = "ext")
    val ext: String?)