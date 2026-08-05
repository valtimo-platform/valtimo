/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

package com.ritense.marketplace

import com.ritense.plugin.PluginDeploymentListener
import com.ritense.plugin.annotation.Plugin
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.persistence.Entity
import jakarta.persistence.EntityManagerFactory
import liquibase.Contexts
import liquibase.LabelExpression
import liquibase.Liquibase
import liquibase.database.DatabaseFactory
import liquibase.database.jvm.JdbcConnection
import liquibase.resource.ClassLoaderResourceAccessor
import org.pf4j.PluginWrapper
import org.springframework.beans.factory.support.DefaultListableBeanFactory
import org.springframework.beans.factory.support.RootBeanDefinition
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory
import org.springframework.stereotype.Component
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping
import java.util.jar.JarFile
import javax.sql.DataSource

/**
 * Deploys the *full* backend of a runtime-loaded package into the host Spring
 * context — not just its pf4j @Extension classes, but every stereotyped class in
 * the plugin jar — so an ordinary Valtimo plugin (services, JPA repositories,
 * REST controllers, its own database tables) works end-to-end after simply being
 * dropped in the packages folder.
 *
 * It is deliberately best-effort and defensive: each phase is isolated so a
 * plugin that only partially fits this host still contributes what it can, and
 * nothing here aborts application startup.
 *
 * Phases, in order (dependencies must exist before the beans that use them):
 *   4. Liquibase — run the plugin's own master changelog so its tables exist.
 *   3. JPA       — create its Spring-Data repositories (attempt; a plugin @Entity
 *                  added after the EntityManagerFactory was built may not be in
 *                  Hibernate's metamodel — see registerRepositories).
 *   1. Beans     — register a bean definition for every @Component/@Service/
 *                  @Controller/@RestController in the jar, then instantiate them
 *                  so constructor autowiring resolves against host + plugin beans.
 *   2. MVC       — register each controller's request mappings with the live
 *                  DispatcherServlet so its endpoints are actually routable.
 *
 * NOTE (@Configuration/@Bean and @AutoConfiguration): classes that contribute
 * beans through @Bean factory methods are NOT processed — that needs the
 * ConfigurationClassPostProcessor which only runs during context refresh. Only
 * directly-stereotyped classes are picked up. Plugins that wire everything with
 * stereotypes load fully; those relying on @Bean methods load partially.
 */
class PackageSpringDeployer(
    private val packageManager: PackageManager,
    private val pluginDeploymentListener: PluginDeploymentListener,
) {
    private val applicationContext get() = packageManager.applicationContext
    private val beanFactory get() = applicationContext.autowireCapableBeanFactory as DefaultListableBeanFactory
    private val deployed = mutableSetOf<String>()

    fun deploy(pkg: PluginWrapper) {
        // Deploy each package's backend exactly once, even if both the plugin
        // STARTED event and the context-refreshed hook fire for it.
        if (!deployed.add(pkg.pluginId)) return
        val classLoader = pkg.pluginClassLoader
        val classes = scanJarForClasses(pkg, classLoader)

        runLiquibase(pkg, classLoader)

        val repositories = classes.filter { isSpringDataRepository(it) }
        val components = classes.filter {
            isStereotyped(it) && !isSpringDataRepository(it) &&
                // PluginFactory implementations belong to the Valtimo @Plugin
                // action framework, not to the plain Spring graph. The host's
                // PluginService discovers every PluginFactory bean by type and
                // tries to instantiate it — so registering a plugin's factories
                // here would make the host choke on them. They also aren't needed
                // for a plugin's ordinary services/controllers to work.
                !isPluginFactory(it)
        }

        // (3) Give the plugin's JPA entities their own EntityManagerFactory over
        // the shared datasource, so repositories work even though the host EMF was
        // sealed at startup.
        val entityManagerFactory = buildEntityManagerFactory(pkg, classLoader, classes)
        registerRepositories(pkg, repositories, entityManagerFactory, classLoader)
        registerConfigurationBeans(pkg, classes)
        val beanNames = registerComponents(pkg, components)
        registerControllerMappings(pkg, beanNames, components)
        deployPluginDefinitions(pkg, classes)
    }

    /**
     * Register the package's Valtimo `@Plugin` classes as plugin definitions so
     * the plugin becomes usable end-to-end after a runtime install (appears in the
     * plugin list, is configurable, its actions are invocable) — not merely loaded
     * as pf4j beans. The startup classpath scan the host normally uses can't see a
     * plugin's own classloader, so we hand the classes to the deployer explicitly.
     * The PluginFactory bean itself is registered via [registerConfigurationBeans]
     * (plugins declare it with an @Bean method) and resolved dynamically by the
     * host PluginService.
     */
    private fun deployPluginDefinitions(pkg: PluginWrapper, classes: List<Class<*>>) {
        val pluginClasses = classes
            .filter { it.isAnnotationPresent(Plugin::class.java) }
            .associateWith { it.getAnnotation(Plugin::class.java) }
        if (pluginClasses.isEmpty()) return
        try {
            pluginDeploymentListener.deployPluginDefinitions(pluginClasses)
        } catch (e: Exception) {
            logger.error(e) { "Failed to deploy plugin definitions for package '${pkg.pluginId}'" }
        }
    }

    /** True if the class extends the host's com.ritense.plugin.PluginFactory. */
    private fun isPluginFactory(clazz: Class<*>): Boolean {
        var c: Class<*>? = clazz.superclass
        while (c != null) {
            if (c.name == "com.ritense.plugin.PluginFactory") return true
            c = c.superclass
        }
        return false
    }

    /**
     * Build a dedicated EntityManagerFactory holding the plugin's @Entity classes
     * and backed by the host datasource (so it sees the tables Liquibase just
     * created). This is how we work around Hibernate's startup-sealed metamodel:
     * rather than mutate the host EMF, the plugin gets its own persistence unit.
     * Returns null when the plugin has no entities.
     */
    private fun buildEntityManagerFactory(
        pkg: PluginWrapper,
        classLoader: ClassLoader,
        classes: List<Class<*>>
    ): EntityManagerFactory? {
        val entities = classes.filter { it.isAnnotationPresent(ENTITY) }
        if (entities.isEmpty()) return null
        return try {
            val dataSource = applicationContext.getBean(DataSource::class.java)
            // Build the persistence unit with Hibernate's native bootstrap and add
            // the plugin's @Entity classes explicitly. Spring's
            // LocalContainerEntityManagerFactoryBean.setManagedTypes yields an EMPTY
            // metamodel for a runtime-built unit (managed classes aren't scanned),
            // so we register the annotated classes directly here instead. The
            // resulting SessionFactory IS a jakarta EntityManagerFactory.
            // Hibernate resolves entity classes through its own ClassLoaderService,
            // which defaults to the host ('app') classloader and can't see plugin
            // classes ("entity class not found"). Seed the bootstrap registry with
            // the plugin classloader so the plugin's @Entity classes resolve.
            val bootstrapRegistry = org.hibernate.boot.registry.BootstrapServiceRegistryBuilder()
                .applyClassLoader(classLoader)
                .build()
            val registry = org.hibernate.boot.registry.StandardServiceRegistryBuilder(bootstrapRegistry)
                .applySetting("hibernate.connection.datasource", dataSource)
                .applySetting("hibernate.hbm2ddl.auto", "none")
                .build()
            val sources = org.hibernate.boot.MetadataSources(registry)
            entities.forEach { sources.addAnnotatedClass(it) }
            val emf = sources.buildMetadata().buildSessionFactory() as EntityManagerFactory
            logger.info {
                "Built EntityManagerFactory for '${pkg.pluginId}'; " +
                    "metamodel managed: ${emf.metamodel.entities.map { it.name }}"
            }
            emf
        } catch (e: Exception) {
            logger.warn { "Could not build EntityManagerFactory for '${pkg.pluginId}': ${e.message}" }
            null
        }
    }

    /**
     * Enumerate the plugin jar's own classes. A plugin "-plain" jar contains only
     * the plugin's classes (no shaded dependencies), so scanning every entry is
     * cheap and avoids guessing a base package — which for real plugins spans
     * several sibling packages (e.g. `.plugin`, `.service`, `.web.rest`).
     */
    private fun scanJarForClasses(pkg: PluginWrapper, classLoader: ClassLoader): List<Class<*>> {
        val jarPath = pkg.pluginPath.toFile()
        if (!jarPath.isFile) return emptyList()
        return JarFile(jarPath).use { jar ->
            jar.entries().asSequence()
                .filter { it.name.endsWith(".class") && !it.name.contains('$') }
                .map { it.name.removeSuffix(".class").replace('/', '.') }
                .mapNotNull { className ->
                    try {
                        Class.forName(className, false, classLoader)
                    } catch (t: Throwable) {
                        // A class that can't even be linked (missing optional dep)
                        // is simply not a candidate; skip it.
                        logger.debug(t) { "Skipping unloadable class '$className' in '${pkg.pluginId}'" }
                        null
                    }
                }
                .toList()
        }
    }

    /** (4) Run the plugin's Liquibase master changelog against the app datasource. */
    private fun runLiquibase(pkg: PluginWrapper, classLoader: ClassLoader) {
        val master = findMasterChangelog(pkg, classLoader) ?: return
        try {
            val dataSource = applicationContext.getBean(DataSource::class.java)
            dataSource.connection.use { connection ->
                val database = DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(JdbcConnection(connection))
                Liquibase(master, ClassLoaderResourceAccessor(classLoader), database)
                    .use { it.update(Contexts(), LabelExpression()) }
            }
            logger.info { "Ran Liquibase changelog '$master' for package '${pkg.pluginId}'" }
        } catch (e: Exception) {
            logger.error(e) { "Failed to run Liquibase for package '${pkg.pluginId}'" }
        }
    }

    /** Convention: a `*-master.xml` under `config/liquibase/` in the plugin jar. */
    private fun findMasterChangelog(pkg: PluginWrapper, classLoader: ClassLoader): String? {
        val candidate = JarFile(pkg.pluginPath.toFile()).use { jar ->
            jar.entries().asSequence()
                .map { it.name }
                .firstOrNull { it.startsWith("config/liquibase/") && it.endsWith("-master.xml") }
        }
        if (candidate == null) return null
        // Sanity check the resource is actually resolvable through the classloader.
        return if (classLoader.getResource(candidate) != null) candidate else null
    }

    /**
     * (3) Create Spring-Data repositories for the plugin. This is the fragile
     * phase: JpaRepositoryFactory needs the repository's domain type to be a
     * managed JPA entity, but Hibernate's EntityManagerFactory metamodel is built
     * once at startup and a plugin @Entity added afterwards is not in it — so this
     * throws "Not a managed type". We attempt it and log the (expected) failure
     * rather than aborting; see the class NOTE.
     */
    private fun registerRepositories(
        pkg: PluginWrapper,
        repositories: List<Class<*>>,
        entityManagerFactory: EntityManagerFactory?,
        classLoader: ClassLoader
    ) {
        if (repositories.isEmpty()) return
        // The host EMF (for repositories over host entities, e.g. JsonSchemaDocument)
        // and the plugin EMF (for the plugin's own entities). A plugin can have both.
        val hostEmf = runCatching { applicationContext.getBean(EntityManagerFactory::class.java) }.getOrNull()
        if (entityManagerFactory != null) {
            // Register the plugin's own transaction manager, but NOT as an autowire
            // candidate so it stays out of by-type TransactionManager resolution.
            // A raw registerSingleton has no BeanDefinition and is therefore always
            // a type-match candidate; once two entity-bearing packages are deployed
            // the host has multiple TransactionManager beans and every unqualified
            // @Transactional in the app (including the marketplace's own install/list)
            // fails with NoUniqueBeanDefinitionException. Plugin repositories are
            // tx-proxied with their own manager explicitly below, so they still work.
            val tmName = "transactionManager-${pkg.pluginId}"
            if (!beanFactory.containsBeanDefinition(tmName) && !beanFactory.containsSingleton(tmName)) {
                val tm = org.springframework.orm.jpa.JpaTransactionManager(entityManagerFactory)
                val tmDef = org.springframework.beans.factory.support.RootBeanDefinition(
                    org.springframework.orm.jpa.JpaTransactionManager::class.java
                )
                tmDef.setInstanceSupplier { tm }
                tmDef.isAutowireCandidate = false
                beanFactory.registerBeanDefinition(tmName, tmDef)
            }
        }
        repositories.forEach { repo ->
            try {
                val domainType = org.springframework.data.repository.core.support.AbstractRepositoryMetadata
                    .getMetadata(repo).domainType
                // Route the repository to whichever EMF actually manages its entity.
                val emf = when {
                    hostEmf != null && isManaged(hostEmf, domainType) -> hostEmf
                    entityManagerFactory != null && isManaged(entityManagerFactory, domainType) -> entityManagerFactory
                    else -> {
                        logger.warn { "No EntityManagerFactory manages '${domainType.name}'; skipping repository '${repo.name}' of '${pkg.pluginId}'" }
                        return@forEach
                    }
                }
                val sharedEm = org.springframework.orm.jpa.SharedEntityManagerCreator.createSharedEntityManager(emf)
                val factory = JpaRepositoryFactory(sharedEm)
                // The repository interface lives in the plugin classloader; the
                // generated proxy must be defined there too ("not visible from class
                // loader 'app'").
                factory.setBeanClassLoader(classLoader)
                val rawRepository = factory.getRepository(repo)
                // Wrap the repository so its methods run inside a transaction on the
                // matching EMF's transaction manager. Without this, save()/merge()
                // fail with "No EntityManager with actual transaction available"
                // because the plugin services aren't @Transactional-proxied here.
                // A JDK interface proxy (getProxy over the repo interfaces) avoids the
                // CGLIB "non-visible class" problem.
                val txInterceptor = org.springframework.transaction.interceptor.TransactionInterceptor(
                    org.springframework.orm.jpa.JpaTransactionManager(emf),
                    org.springframework.transaction.interceptor.MatchAlwaysTransactionAttributeSource()
                )
                val proxyFactory = org.springframework.aop.framework.ProxyFactory(rawRepository)
                proxyFactory.addAdvice(txInterceptor)
                beanFactory.registerSingleton(beanName(repo), proxyFactory.getProxy(classLoader))
                logger.info { "Registered repository '${repo.name}' for '${pkg.pluginId}'" }
            } catch (e: Exception) {
                logger.warn { "Could not register repository '${repo.name}' of '${pkg.pluginId}': ${e.message}" }
            }
        }
    }

    private fun isManaged(emf: EntityManagerFactory, type: Class<*>): Boolean =
        runCatching { emf.metamodel.managedType(type); true }.getOrDefault(false)

    private fun hasBeanOfType(type: Class<*>): Boolean =
        runCatching { beanFactory.getBeanNamesForType(type, false, false).isNotEmpty() }.getOrDefault(false)

    private fun registerSingletonIfAbsent(name: String, bean: Any) {
        if (!beanFactory.containsSingleton(name)) beanFactory.registerSingleton(name, bean)
    }

    /**
     * Process the plugin's @Configuration / @AutoConfiguration classes by invoking
     * their @Bean factory methods and registering the results as singletons. Spring's
     * ConfigurationClassPostProcessor only runs during context refresh, so beans
     * contributed via @Bean methods (e.g. freemarker's `freemarker.template.Configuration`)
     * would otherwise be missing. We instantiate each config class and call its @Bean
     * methods, resolving their parameters from the context (host + already-registered
     * plugin beans). Best-effort: a method whose dependencies aren't available is skipped.
     *
     * Caveat: the config classes are not CGLIB-enhanced here, so a @Bean method that
     * calls another @Bean method directly would create a new instance rather than reuse
     * the singleton. That's fine for the common "provide a third-party config object" case.
     */
    private fun registerConfigurationBeans(pkg: PluginWrapper, classes: List<Class<*>>) {
        val configs = classes.filter { c ->
            c.annotations.any {
                val n = it.annotationClass.qualifiedName
                n == "org.springframework.context.annotation.Configuration" ||
                    n == "org.springframework.boot.autoconfigure.AutoConfiguration"
            }
        }
        configs.forEach { configClass ->
            val instance = try {
                beanFactory.createBean(configClass)
            } catch (e: Exception) {
                logger.warn { "Could not instantiate config '${configClass.name}' of '${pkg.pluginId}': ${e.message}" }
                return@forEach
            }
            configClass.methods
                .filter { m -> m.annotations.any { it.annotationClass.qualifiedName == "org.springframework.context.annotation.Bean" } }
                .forEach { method ->
                    val name = method.name
                    if (beanFactory.containsSingleton(name)) return@forEach
                    // Honour @ConditionalOnMissingBean / avoid duplicates: skip if a
                    // bean of the method's return type already exists (a plugin often
                    // declares the same class as both @Component and a conditional
                    // @Bean; registering both would break singletons like value
                    // resolvers that must be unique per prefix).
                    if (hasBeanOfType(method.returnType)) return@forEach
                    try {
                        val args = method.parameterTypes.map { beanFactory.getBean(it) }.toTypedArray()
                        val bean = method.invoke(instance, *args) ?: return@forEach
                        beanFactory.registerSingleton(name, bean)
                        logger.info { "Registered @Bean '$name' from '${configClass.simpleName}' for '${pkg.pluginId}'" }
                    } catch (e: Exception) {
                        logger.debug { "Skipping @Bean '$name' of '${pkg.pluginId}': ${e.message}" }
                    }
                }
        }
    }

    /**
     * (1) Construct and register the plugin's stereotyped beans.
     *
     * We use constructor autowiring WITHOUT bean post-processing
     * (`autowire(clazz, AUTOWIRE_CONSTRUCTOR, false)`, the same call
     * WhitelistSpringExtensionFactory uses) rather than a bean definition + getBean.
     * Two reasons: (a) getBean would apply @Transactional/@Async auto-proxies, and
     * Spring generates those CGLIB proxies in the host classloader, which can't see
     * a plugin class ("Could not generate CGLIB subclass … non-visible class"); and
     * (b) a half-created bean definition left in the registry would later be picked
     * up by the host's getBeansOfType scans and crash startup.
     *
     * A raw instance skips class-level @Transactional advice, but repository methods
     * remain transactional in their own right, which covers ordinary CRUD.
     *
     * Beans are created in a fixpoint loop: each pass instantiates those whose
     * constructor dependencies are already satisfiable (host beans + plugin beans
     * registered so far); passes repeat until no more can be created. This resolves
     * intra-plugin ordering without a topological sort.
     */
    private fun registerComponents(pkg: PluginWrapper, components: List<Class<*>>): List<String> {
        val registered = mutableListOf<String>()
        val remaining = components.toMutableList()
        var lastError: MutableMap<String, String> = mutableMapOf()
        while (true) {
            var progressed = false
            val iterator = remaining.iterator()
            while (iterator.hasNext()) {
                val clazz = iterator.next()
                val name = beanName(clazz)
                if (beanFactory.containsSingleton(name)) { iterator.remove(); continue }
                // Already provided (e.g. via a conditional @Bean of the same type)? skip.
                if (hasBeanOfType(clazz)) { iterator.remove(); continue }
                try {
                    val instance = beanFactory.autowire(
                        clazz,
                        org.springframework.beans.factory.config.AutowireCapableBeanFactory.AUTOWIRE_CONSTRUCTOR,
                        false
                    )
                    beanFactory.registerSingleton(name, instance)
                    registered += name
                    iterator.remove()
                    progressed = true
                } catch (e: Exception) {
                    lastError[name] = e.message ?: e.javaClass.simpleName
                }
            }
            if (!progressed) break
        }
        remaining.forEach { clazz ->
            logger.warn { "Could not create bean '${clazz.name}' of '${pkg.pluginId}': ${lastError[beanName(clazz)]}" }
        }
        logger.info { "Registered ${registered.size} bean(s) for '${pkg.pluginId}': ${registered.map { it.substringAfterLast('.') }}" }
        return registered
    }

    /**
     * (2) Make the plugin's controllers routable. Beans registered after context
     * refresh are invisible to the DispatcherServlet's RequestMappingHandlerMapping,
     * so we ask it to (re)detect the handler methods of each controller bean. The
     * detectHandlerMethods(Object) hook is protected, hence reflection.
     */
    private fun registerControllerMappings(
        pkg: PluginWrapper,
        beanNames: List<String>,
        components: List<Class<*>>
    ) {
        val controllers = beanNames.filter { name ->
            val type = beanFactory.getType(name)
            type != null && (type.isAnnotationPresent(RestController::class.java) ||
                type.isAnnotationPresent(Controller::class.java))
        }
        logger.info { "Controller candidates for '${pkg.pluginId}': ${controllers.map { it.substringAfterLast('.') }}" }
        if (controllers.isEmpty()) return
        // Fetch the MVC handler mapping by name: there are several beans of this
        // type (e.g. actuator's controllerEndpointHandlerMapping), so by-type
        // lookup is ambiguous.
        val handlerMapping = runCatching {
            applicationContext.getBean("requestMappingHandlerMapping", RequestMappingHandlerMapping::class.java)
        }.getOrNull() ?: return
        // detectHandlerMethods(Object) is declared on the superclass
        // AbstractHandlerMethodMapping, so search up the hierarchy.
        val detect = generateSequence<Class<*>>(handlerMapping.javaClass) { it.superclass }
            .mapNotNull { runCatching { it.getDeclaredMethod("detectHandlerMethods", Any::class.java) }.getOrNull() }
            .first()
            .apply { isAccessible = true }
        controllers.forEach { name ->
            try {
                detect.invoke(handlerMapping, name)
                logger.info { "Registered controller '$name' request mappings for '${pkg.pluginId}'" }
            } catch (e: Exception) {
                logger.warn { "Could not register controller '$name' of '${pkg.pluginId}': ${e.message}" }
            }
        }
    }

    private fun isStereotyped(clazz: Class<*>): Boolean =
        STEREOTYPES.any { clazz.isAnnotationPresent(it) }

    private fun isSpringDataRepository(clazz: Class<*>): Boolean =
        clazz.isInterface &&
            org.springframework.data.repository.Repository::class.java.isAssignableFrom(clazz)

    private fun beanName(clazz: Class<*>): String = clazz.name

    private companion object {
        private val logger = KotlinLogging.logger {}
        private val STEREOTYPES = listOf(
            Component::class.java,
            Controller::class.java,
            RestController::class.java,
            org.springframework.stereotype.Service::class.java,
            org.springframework.stereotype.Repository::class.java,
        )
        // Marker so entity scanning intent is explicit even though registration
        // is currently unsupported (see registerRepositories).
        private val ENTITY = Entity::class.java
    }
}