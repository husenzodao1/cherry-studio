# Release builds are not minified (see build.gradle.kts). Rules kept here for when they are.
-keepclassmembers class app.coefmonitor.core.** { *** Companion; }
-keepclasseswithmembers class app.coefmonitor.core.** { kotlinx.serialization.KSerializer serializer(...); }
