package com.cerberuzz91141.mobile

import android.app.KeyguardManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.util.Locale

class AdminStatsWidgetProvider : AppWidgetProvider() {

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == Intent.ACTION_USER_PRESENT) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisAppWidgetComponentName = ComponentName(context.packageName, javaClass.name)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(thisAppWidgetComponentName)
            onUpdate(context, appWidgetManager, appWidgetIds)
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val prefs: SharedPreferences = context.getSharedPreferences("spay_widget_prefs", Context.MODE_PRIVATE)
        val dataStr = prefs.getString("spay_widget_data", "") ?: ""

        val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        val isLocked = keyguardManager?.isKeyguardLocked ?: false

        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_admin_stats)

            // Setup deep link to Admin Dashboard / App Launch
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                data = Uri.parse("exp+mobile://admin")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            } ?: Intent(Intent.ACTION_VIEW, Uri.parse("exp+mobile://admin")).apply {
                setPackage(context.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val launchPI = PendingIntent.getActivity(
                context, appWidgetId, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_root, launchPI)
            views.setOnClickPendingIntent(R.id.txt_active_clients, launchPI)
            views.setOnClickPendingIntent(R.id.txt_total_orders, launchPI)
            views.setOnClickPendingIntent(R.id.txt_collection_efficiency, launchPI)

            if (dataStr.isEmpty()) {
                renderDefaultState(views, isLocked, launchPI)
            } else {
                try {
                    val root = JSONObject(dataStr)
                    val isLoggedIn = root.optBoolean("isLoggedIn", false)

                    if (!isLoggedIn) {
                        views.setTextViewText(R.id.txt_active_clients, "--")
                        views.setTextViewText(R.id.txt_total_orders, "--")
                        views.setTextViewText(R.id.txt_collection_efficiency, "--%")
                    } else {
                        val clients = root.optInt("clientsCount", 0)
                        val orders = root.optInt("ordersCount", 0)
                        val efficiency = root.optDouble("globalCollectionRate", 0.0)

                        if (isLocked) {
                            views.setTextViewText(R.id.txt_active_clients, "**")
                            views.setTextViewText(R.id.txt_total_orders, "**")
                            views.setTextViewText(R.id.txt_collection_efficiency, "**%")
                        } else {
                            views.setTextViewText(R.id.txt_active_clients, clients.toString())
                            views.setTextViewText(R.id.txt_total_orders, orders.toString())
                            views.setTextViewText(R.id.txt_collection_efficiency, String.format(Locale.US, "%.1f%%", efficiency))
                            
                            // Adjust efficiency color
                            if (efficiency >= 90.0) {
                                views.setTextColor(R.id.txt_collection_efficiency, 0xFF34C759.toInt())
                            } else if (efficiency >= 75.0) {
                                views.setTextColor(R.id.txt_collection_efficiency, 0xFFFFCC00.toInt())
                            } else {
                                views.setTextColor(R.id.txt_collection_efficiency, 0xFFFF3B30.toInt())
                            }
                        }
                    }
                } catch (e: Exception) {
                    renderDefaultState(views, isLocked, launchPI)
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }

    private fun renderDefaultState(views: RemoteViews, isLocked: Boolean, launchPI: PendingIntent) {
        views.setTextViewText(R.id.txt_active_clients, if (isLocked) "**" else "0")
        views.setTextViewText(R.id.txt_total_orders, if (isLocked) "**" else "0")
        views.setTextViewText(R.id.txt_collection_efficiency, if (isLocked) "**%" else "0.0%")
        views.setOnClickPendingIntent(R.id.widget_root, launchPI)
    }
}
