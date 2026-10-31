// Test helper, never shipped: a separate app that plays a tone like any music app would,
// so the device tests can check that Hamnavo captures other apps' audio.
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "tj.hamnavo.tonegen"
    compileSdk = 34

    defaultConfig {
        applicationId = "tj.hamnavo.tonegen"
        minSdk = 29
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}
