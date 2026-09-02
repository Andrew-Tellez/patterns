import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm") version "2.4.10"
    // Core Gradle plugins, so coverage and publishing cost no dependency.
    jacoco
    `maven-publish`
    signing
}

group = "io.github.andrew-tellez"
version = "0.1.0"

repositories {
    mavenCentral()
}

dependencies {
    // The only dependency in the project, and it never ships: kotlin.test is the
    // standard-library test runner.
    testImplementation(kotlin("test"))
}

kotlin {
    // A published library states the visibility and return type of everything public.
    explicitApi()
    compilerOptions {
        jvmTarget = JvmTarget.JVM_17
        // Compile against the JDK 17 API even on a newer JDK, so the jar cannot
        // accidentally link against something Java 17 does not have.
        freeCompilerArgs.add("-Xjdk-release=17")
    }
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
    // Maven Central requires both. The javadoc jar is empty — there are no Java
    // sources — which Central accepts; KDoc lives in the sources jar.
    withSourcesJar()
    withJavadocJar()
}

tasks.test {
    useJUnitPlatform()
    testLogging { events("passed", "failed", "skipped") }
    finalizedBy(tasks.jacocoTestReport)
}

tasks.jacocoTestReport {
    dependsOn(tasks.test)
    reports {
        xml.required = true
        html.required = true
    }
}

// Thresholds sit just under what the suite reaches, so a real regression fails the
// build but a refactor that shifts one branch does not.
tasks.jacocoTestCoverageVerification {
    dependsOn(tasks.jacocoTestReport)
    violationRules {
        rule {
            limit {
                counter = "LINE"
                minimum = "0.99".toBigDecimal()
            }
            limit {
                counter = "BRANCH"
                minimum = "0.95".toBigDecimal()
            }
        }
    }
}

tasks.check {
    dependsOn(tasks.jacocoTestCoverageVerification)
}


// --- Publishing to Maven Central -------------------------------------------
//
// Central has no OIDC, so unlike npm and PyPI this needs secrets: a Portal user
// token and a GPG key. See CONTRIBUTING.md for the one-time setup.
//
// The Portal takes a zip of a Maven repository layout, so we publish into a local
// directory and zip it, rather than pushing to a staging repository.

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["java"])
            pom {
                name = "gof-patterns"
                description =
                    "The 22 Gang of Four design patterns as small, typed helpers. " +
                    "Zero dependencies."
                url = "https://github.com/Andrew-Tellez/patterns"
                inceptionYear = "2026"
                licenses {
                    license {
                        name = "MIT License"
                        url = "https://opensource.org/licenses/MIT"
                        distribution = "repo"
                    }
                }
                developers {
                    developer {
                        id = "Andrew-Tellez"
                        name = "Andrew Tellez"
                        url = "https://github.com/Andrew-Tellez"
                    }
                }
                scm {
                    connection = "scm:git:https://github.com/Andrew-Tellez/patterns.git"
                    developerConnection = "scm:git:ssh://git@github.com/Andrew-Tellez/patterns.git"
                    url = "https://github.com/Andrew-Tellez/patterns"
                }
            }
        }
    }
    repositories {
        maven {
            name = "centralBundle"
            url = uri(layout.buildDirectory.dir("central-bundle"))
        }
    }
}

signing {
    // The key comes from the environment, so CI needs no keyring on disk and a
    // local build without the key still works — it just produces no signatures.
    val key = providers.environmentVariable("SIGNING_KEY").orNull
    val passphrase = providers.environmentVariable("SIGNING_PASSPHRASE").orNull
    isRequired = key != null
    if (key != null) {
        useInMemoryPgpKeys(key, passphrase)
        sign(publishing.publications["maven"])
    }
}

/**
 * The deployment bundle the Central Portal accepts: a Maven repository layout,
 * zipped, with no maven-metadata files — Central rejects those.
 */
val centralBundle by tasks.registering(Zip::class) {
    group = "publishing"
    description = "Builds the zip to upload to the Maven Central Portal."
    dependsOn(tasks.named("publishMavenPublicationToCentralBundleRepository"))
    from(layout.buildDirectory.dir("central-bundle"))
    exclude("**/maven-metadata.*")
    archiveFileName = "central-bundle-$version.zip"
    destinationDirectory = layout.buildDirectory.dir("distributions")
}
