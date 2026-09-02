import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm") version "2.4.10"
    // Core Gradle plugin, so coverage costs no dependency.
    jacoco
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
