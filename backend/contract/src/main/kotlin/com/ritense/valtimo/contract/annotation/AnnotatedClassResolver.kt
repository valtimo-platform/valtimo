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

package com.ritense.valtimo.contract.annotation

import io.github.classgraph.ClassInfo
import io.github.classgraph.ScanResult
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.context.ApplicationContext
import java.lang.reflect.Method

/**
 *  The AnnotatedClassResolver can scan for classes and methods with a specific annotation.
 *  It will only scan for classes that are inside whitelisted packages. Whitelisted packages include:
 *  - com.ritense.*
 *  - The package of the class that has the `@SpringBootApplication` annotation
 *  - Packages that are defined by property: `valtimo.annotation-scan.accepted-packages`
 *
 *  The scan itself is done by the [AnnotationScanner] bean, shared with every resolver in the context.
 */
abstract class AnnotatedClassResolver(
    val context: ApplicationContext
) : AutoCloseable {

    // Written under the lazy below, read by close() on the thread that shuts the context down
    @Volatile
    private var ownScanner: AnnotationScanner? = null

    private val scanner: AnnotationScanner by lazy {
        // Own scanner keeps apps that exclude ContractAutoConfiguration working
        context.getBeanProvider(AnnotationScanner::class.java).getIfAvailable {
            AnnotationScanner(context).also { ownScanner = it }
        }
    }

    inline fun <reified T : Annotation> findMethodsWithAnnotation(): List<Method> {
        return findMethodsWithAnnotation(T::class.java)
    }

    fun <T : Annotation> findMethodsWithAnnotation(annotation: Class<T>): List<Method> {
        return withScanResult { scanResult ->
            scanResult.getClassesWithMethodAnnotation(annotation)
                .filter { canLoadClass(it, annotation) }
                .flatMap { it.methodInfo }
                .filter { it.hasAnnotation(annotation) }
                .map { it.loadClassAndGetMethod() }
        }
    }

    inline fun <reified T : Annotation> findClassesWithAnnotation(): Map<Class<*>, T> {
        return findClassesWithAnnotation(T::class.java)
    }

    @Suppress("UNCHECKED_CAST")
    fun <T : Annotation> findClassesWithAnnotation(annotation: Class<T>): Map<Class<*>, T> {
        return withScanResult { scanResult ->
            scanResult.getClassesWithAnnotation(annotation)
                .filter { canLoadClass(it, annotation) }
                .associate {
                    it.loadClass() to it.getAnnotationInfo(annotation).loadClassAndInstantiate() as T
                }
        }
    }

    inline fun <reified T> canLoadClass(classInfo: ClassInfo): Boolean {
        return canLoadClass(classInfo, T::class.java)
    }

    fun canLoadClass(classInfo: ClassInfo, annotation: Class<*>): Boolean {
        return try {
            classInfo.loadClass()
            true
        } catch (e: Exception) {
            logger.warn { "Unable to load ${annotation.simpleName} ${classInfo.name} class, skipped" }
            logger.debug(e) { "Unable to load ${annotation.simpleName} ${classInfo.name} because of the following exception" }
            false
        }
    }

    private fun <T> withScanResult(block: (ScanResult) -> T): T =
        scanner.withScanResult(getAcceptPackages(), block)

    internal fun scanResult(): ScanResult = scanner.getScanResult(getAcceptPackages())

    /** Only the own scanner. Other resolvers still use the shared bean; the context closes that one. */
    override fun close() {
        ownScanner?.close()
        ownScanner = null
    }

    fun getAcceptPackages(): Array<String> {
        val springBootApplicationPackages = context.getBeansWithAnnotation(SpringBootApplication::class.java).values
            .map { it.javaClass.packageName }
            .toTypedArray()

        val acceptedPackagesProperty = context.environment.getProperty(
            "valtimo.annotation-scan.accepted-packages",
            Array<String>::class.java,
            emptyArray<String>()
        )

        return springBootApplicationPackages + acceptedPackagesProperty + "com.ritense"
    }

    companion object {
        val logger = KotlinLogging.logger {}
    }
}