plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The app is sideload-only, so a keystore is committed to the repo.
// CI may override it with secrets via these environment variables.
fun env(name: String): String? = System.getenv(name)?.takeIf { it.isNotBlank() }

android {
    namespace = "tj.hamnavo"
    compileSdk = 34

    defaultConfig {
        applicationId = "tj.hamnavo"
        minSdk = 29
        targetSdk = 34
        // Minutes since 2026-01-01: every new build installs over the previous one.
        versionCode = ((System.currentTimeMillis() - 1_767_225_600_000L) / 60_000).toInt()
        versionName = "1.0." + (env("GITHUB_RUN_NUMBER") ?: "0")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    // Device tests run against the signed release build, i.e. exactly the APK people install.
    testBuildType = "release"

    signingConfigs {
        create("release") {
            storeFile = file(env("HAMNAVO_KEYSTORE") ?: "hamnavo-release.jks")
            storePassword = env("HAMNAVO_KEYSTORE_PASSWORD") ?: "hamnavo-sideload"
            keyAlias = env("HAMNAVO_KEY_ALIAS") ?: "hamnavo"
            keyPassword = env("HAMNAVO_KEY_PASSWORD") ?: "hamnavo-sideload"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    testOptions {
        unitTests.all { it.testLogging { events("passed", "failed", "skipped") } }
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")

    // Test-only: none of these end up in the app APK.
    androidTestImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test:core:1.6.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test:rules:1.6.1")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.uiautomator:uiautomator:2.3.0")
}
