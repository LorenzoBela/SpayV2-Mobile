package com.cerberuzz91141.mobile

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SpayWidgetModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String {
        return "SpayWidgetModule"
    }

    @ReactMethod
    fun updateWidgetData(dataString: String) {
        val context = reactApplicationContext
        // Save payload JSON to SharedPreferences
        val prefs: SharedPreferences = context.getSharedPreferences("spay_widget_prefs", Context.MODE_PRIVATE)
        prefs.edit().putString("spay_widget_data", dataString).apply()

        // Reset month navigation indices back to 0 (default/most urgent month view) on fresh sync
        prefs.edit().putInt("client_selected_month_index", 0).apply()
        prefs.edit().putInt("admin_selected_month_index", 0).apply()

        // Notify all widgets using a helper method
        broadcastToProvider(context, ClientCountdownWidgetProvider::class.java)
        broadcastToProvider(context, CreditLimitWidgetProvider::class.java)
        broadcastToProvider(context, NootAiWidgetProvider::class.java)
        broadcastToProvider(context, ClientTransactionsWidgetProvider::class.java)
        broadcastToProvider(context, ClientHealthWidgetProvider::class.java)
        broadcastToProvider(context, ClientUpcomingWidgetProvider::class.java)
        broadcastToProvider(context, ClientInboxWidgetProvider::class.java)
        broadcastToProvider(context, AdminCountdownWidgetProvider::class.java)
        broadcastToProvider(context, AdminExposureWidgetProvider::class.java)
        broadcastToProvider(context, AdminRemindersWidgetProvider::class.java)
        broadcastToProvider(context, AdminStatsWidgetProvider::class.java)
        broadcastToProvider(context, AdminAuditWidgetProvider::class.java)
    }

    private fun broadcastToProvider(context: Context, providerClass: Class<*>) {
        val intent = Intent(context, providerClass).apply {
            action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
        }
        val ids = AppWidgetManager.getInstance(context).getAppWidgetIds(
            ComponentName(context, providerClass)
        )
        if (ids.isNotEmpty()) {
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            context.sendBroadcast(intent)
        }
    }
}
