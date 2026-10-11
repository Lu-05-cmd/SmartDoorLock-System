plugins {
    id("com.android.application") version "8.7.3"
}

android {
    namespace = "com.facedoor.lock"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.facedoor.lock"
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}