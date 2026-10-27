pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "coefficient-monitor"

// The pure-Kotlin domain logic is a standalone build so it can be compiled and tested
// with Maven Central alone (no Android SDK). The app consumes it as app.coefmonitor:core.
includeBuild("core")
include(":app")
