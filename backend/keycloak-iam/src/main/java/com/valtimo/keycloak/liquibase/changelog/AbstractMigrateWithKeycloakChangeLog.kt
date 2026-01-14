/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.valtimo.keycloak.liquibase.changelog

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.valtimo.contract.Constants.SYSTEM_ACCOUNT
import com.ritense.valtimo.contract.annotation.AllOpen
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.ws.rs.NotFoundException
import java.nio.ByteBuffer
import java.sql.ResultSet
import java.util.UUID
import liquibase.database.Database
import liquibase.database.jvm.JdbcConnection
import org.jboss.resteasy.client.jaxrs.internal.ResteasyClientBuilderImpl
import org.jboss.resteasy.plugins.providers.jackson.ResteasyJackson2Provider
import org.keycloak.OAuth2Constants.CLIENT_CREDENTIALS
import org.keycloak.adapters.springboot.KeycloakSpringBootProperties
import org.keycloak.admin.client.Keycloak
import org.keycloak.admin.client.KeycloakBuilder
import org.keycloak.representations.idm.AbstractUserRepresentation
import org.keycloak.representations.idm.UserRepresentation
import org.springframework.boot.SpringApplication
import org.springframework.boot.env.EnvironmentPostProcessor
import org.springframework.core.env.ConfigurableEnvironment
import org.springframework.core.env.Environment
import org.springframework.util.ConcurrentLruCache

@AllOpen
abstract class AbstractMigrateWithKeycloakChangeLog : EnvironmentPostProcessor {

    override fun postProcessEnvironment(environment: ConfigurableEnvironment, application: SpringApplication) {
        Companion.environment = environment
        Companion.userCache =
            ConcurrentLruCache<String?, AbstractUserRepresentation?>(DEFAULT_BUFFER_SIZE, ::getKeycloakUserFromKeycloak)
    }

    protected fun checkTableExists(connection: JdbcConnection, tableName: String): Boolean {
        val schemaOrDatabaseName = if (connection.databaseProductName == "PostgreSQL") {
            getDatabaseSchema(connection)
        } else {
            connection.catalog
        }

        val sql = """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = ?
              AND table_name = ?
        );
    """.trimIndent()

        connection.prepareStatement(sql).use { stmt ->
            stmt.setString(1, schemaOrDatabaseName)
            stmt.setString(2, tableName)

            stmt.executeQuery().use { rs ->
                return rs.next() && rs.getBoolean(1)
            }
        }
    }

    protected fun checkTableIsNotEmpty(connection: JdbcConnection, tableName: String): Boolean {
        if (!checkTableExists(connection, tableName)) {
            return false
        }

        val sql = "SELECT EXISTS (SELECT 1 FROM $tableName LIMIT 1);"

        connection.prepareStatement(sql).use { stmt ->
            stmt.executeQuery().use { rs ->
                return rs.next() && rs.getBoolean(1)
            }
        }
    }


    protected fun getDatabaseSchema(connection: JdbcConnection): String {
        val result = connection.prepareStatement("SELECT current_schema()").executeQuery()
        result.next()
        return result.getString(1)
    }

    protected fun executeUpdate(connection: JdbcConnection, sql: String, vararg params: Any?): Int {
        val statement = connection.prepareStatement(sql)
        params.forEachIndexed { i, param ->
            val parameterIndex = i + 1
            when (param) {
                is String -> statement.setString(parameterIndex, param)
                null -> statement.setString(parameterIndex, null)
                else -> statement.setObject(parameterIndex, param)
            }
        }
        return statement.executeUpdate()
    }

    protected fun getKeycloakUser(emailOrUsernameOrUserId: String?): AbstractUserRepresentation? {
        return if (emailOrUsernameOrUserId == null) {
            null
        } else {
            userCache[emailOrUsernameOrUserId]
        }
    }

    protected fun getKeycloakUserFromKeycloak(emailOrUsernameOrUserId: String?): AbstractUserRepresentation? {
        if (emailOrUsernameOrUserId == null) {
            return null
        } else if (emailOrUsernameOrUserId == SYSTEM_ACCOUNT) {
            val systemUser = UserRepresentation()
            systemUser.id = SYSTEM_ACCOUNT
            systemUser.username = SYSTEM_ACCOUNT
            systemUser.email = SYSTEM_ACCOUNT
            return systemUser
        }

        val properties = keycloakProperties()

        keycloak().use { keycloak ->
            val keycloakRealmUsers = keycloak.realm(properties.realm).users()
            try {
                if (EMAIL_REGEX_PERMISSIVE.matches(emailOrUsernameOrUserId)) {
                    return keycloakRealmUsers
                        .searchByEmail(emailOrUsernameOrUserId, true)
                        .maxByOrNull { it.isEnabled || it.isEmailVerified }
                        ?: throw KeycloakUserNotFoundException()
                }
            } catch (_: KeycloakUserNotFoundException) {
                logger.debug { "Unable to find user with email $emailOrUsernameOrUserId, trying username instead." }
            }

            return keycloakRealmUsers
                .searchByUsername(emailOrUsernameOrUserId, true)
                .maxByOrNull { it.isEnabled || it.isEmailVerified }
                ?: try {
                    keycloakRealmUsers[emailOrUsernameOrUserId].toRepresentation()
                } catch (_: NotFoundException) {
                    logger.info { "Unable to find user with username $emailOrUsernameOrUserId. Check if this user still exists. " }
                    throw KeycloakUserNotFoundException()
                }
        }
    }

    protected fun pingKeycloak() {
        keycloak().serverInfo().info
    }

    /** Logic was copied from `KeycloakService.keycloak()` */
    protected fun keycloak(): Keycloak {
        val mapper = ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)

        val jacksonProvider = ResteasyJackson2Provider()
        jacksonProvider.setMapper(mapper)

        val resteasyClient = ResteasyClientBuilderImpl()
            .connectionPoolSize(10)
            .register(jacksonProvider)
            .build()

        val properties = keycloakProperties()
        return KeycloakBuilder.builder()
            .serverUrl(properties.authServerUrl)
            .realm(properties.realm)
            .grantType(CLIENT_CREDENTIALS)
            .clientId(properties.resource)
            .clientSecret(properties.credentials["secret"] as String?)
            .resteasyClient(resteasyClient)
            .build()
    }

    /** Logic was copied from `ValtimoKeycloakPropertyResolver.resolveProperties()` */
    protected fun keycloakProperties(): KeycloakSpringBootProperties {
        val issuerUri = environment.getProperty(OAUTH2_ISSUER_URI)
            ?: return KeycloakSpringBootProperties(
                environment.getProperty(KEYCLOAK_REALM_PROPERTY),
                environment.getProperty(KEYCLOAK_AUTH_SERVER_URL_PROPERTY),
                environment.getProperty(KEYCLOAK_RESOURCE_PROPERTY),
                mapOf("secret" to environment.getProperty(KEYCLOAK_SECRET_PROPERTY))
            )

        val clientId = environment.getProperty(OAUTH2_CLIENT_ID)
        val secret = environment.getProperty(OAUTH2_CLIENT_SECRET)
        val (authServerUrl, realm) = issuerUri.split("realms/".toRegex())
        return KeycloakSpringBootProperties(
            realm,
            authServerUrl,
            clientId,
            mapOf("secret" to secret)
        )
    }

    protected fun getIdFromResultSet(
        database: Database,
        results: ResultSet,
        columnName: String
    ): UUID? {
        return if (database.databaseProductName == "MySQL") {
            val bytesResult = results.getBytes(columnName)
            bytesResult?.let {
                val byteBuffer = ByteBuffer.wrap(it)
                UUID(byteBuffer.long, byteBuffer.long)
            }
        } else {
            val stringResult = results.getString(columnName)
            stringResult?.let { UUID.fromString(it) }
        }
    }

    protected class KeycloakUserNotFoundException() : RuntimeException("Failed to find Keycloak user")

    companion object {
        private const val KEYCLOAK_AUTH_SERVER_URL_PROPERTY = "keycloak.auth-server-url"
        private const val KEYCLOAK_REALM_PROPERTY = "keycloak.realm"
        private const val KEYCLOAK_RESOURCE_PROPERTY = "keycloak.resource"
        private const val KEYCLOAK_SECRET_PROPERTY = "keycloak.credentials.secret"
        private const val OAUTH2_ISSUER_URI = "spring.security.oauth2.client.provider.keycloakapi.issuer-uri"
        private const val OAUTH2_CLIENT_ID = "spring.security.oauth2.client.registration.keycloakapi.client-id"
        private const val OAUTH2_CLIENT_SECRET = "spring.security.oauth2.client.registration.keycloakapi.client-secret"

        private val EMAIL_REGEX_PERMISSIVE = Regex("""^[^@]+@[^@]+\.[^@]+$""")

        protected lateinit var environment: Environment

        protected lateinit var userCache: ConcurrentLruCache<String?, AbstractUserRepresentation?>
        private val logger = KotlinLogging.logger {}
    }
}
