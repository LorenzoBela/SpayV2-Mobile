package com.cerberuzz91141.mobile

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.MessageDigest

class SpayWidgetModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String {
        return "SpayWidgetModule"
    }

    @ReactMethod
    fun updateWidgetData(dataString: String) {
        val context = reactApplicationContext
        val prefs: SharedPreferences = context.getSharedPreferences("spay_widget_prefs", Context.MODE_PRIVATE)

        // SHA-256 payload diffing to prevent redundant Binder IPC redraws & conserve battery
        val currentHash = prefs.getString("spay_payload_sha256", "") ?: ""
        val newHash = calculateSha256(dataString)

        if (currentHash == newHash && newHash.isNotEmpty()) {
            return
        }

        prefs.edit()
            .putString("spay_widget_data", dataString)
            .putString("spay_payload_sha256", newHash)
            .putInt("client_selected_month_index", 0)
            .putInt("admin_selected_month_index", 0)
            .commit()

        val appWidgetManager = AppWidgetManager.getInstance(context)

        // Broadcast and update all 12 widget providers
        val providers: Array<Class<out AppWidgetProvider>> = arrayOf(
            ClientCountdownWidgetProvider::class.java,
            CreditLimitWidgetProvider::class.java,
            NootAiWidgetProvider::class.java,
            ClientTransactionsWidgetProvider::class.java,
            ClientHealthWidgetProvider::class.java,
            ClientUpcomingWidgetProvider::class.java,
            ClientInboxWidgetProvider::class.java,
            AdminCountdownWidgetProvider::class.java,
            AdminExposureWidgetProvider::class.java,
            AdminRemindersWidgetProvider::class.java,
            AdminStatsWidgetProvider::class.java,
            AdminAuditWidgetProvider::class.java
        )

        for (providerClass in providers) {
            updateAndBroadcastProvider(context, appWidgetManager, providerClass)
        }
    }

    private fun updateAndBroadcastProvider(context: Context, appWidgetManager: AppWidgetManager, providerClass: Class<out AppWidgetProvider>) {
        val ids = appWidgetManager.getAppWidgetIds(ComponentName(context, providerClass))
        if (ids.isNotEmpty()) {
            try {
                // Direct synchronous onUpdate call
                val providerInstance = providerClass.getDeclaredConstructor().newInstance()
                providerInstance.onUpdate(context, appWidgetManager, ids)
            } catch (e: Exception) {
                e.printStackTrace()
            }

            // Invalidate collection view data caches
            appWidgetManager.notifyAppWidgetViewDataChanged(ids, R.id.widget_list_view)

            // Send standard system broadcast
            val intent = Intent(context, providerClass).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }
    }

    private fun calculateSha256(input: String): String {
        return try {
            val md = MessageDigest.getInstance("SHA-256")
            val digest = md.digest(input.toByteArray())
            digest.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            ""
        }
    }
}
