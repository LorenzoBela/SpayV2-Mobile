package com.cerberuzz91141.mobile

import android.app.KeyguardManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.util.Locale

class AdminStatsWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val prefs: SharedPreferences = context.getSharedPreferences("spay_widget_prefs", Context.MODE_PRIVATE)
        val dataStr = prefs.getString("spay_widget_data", "") ?: ""

        val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        val isLocked = keyguardManager.isKeyguardLocked

        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_admin_stats)

            // Setup deep link to Admin Dashboard
            val launchIntent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("exp+mobile://admin/dashboard")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val launchPI = PendingIntent.getActivity(
                context, 70, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.txt_stat_clients, launchPI)

            if (dataStr.isEmpty()) {
                renderDefaultState(views, isLocked)
            } else {
                try {
                    val root = JSONObject(dataStr)
                    val isLoggedIn = root.optBoolean("isLoggedIn", false)
                    val isOffline = root.optBoolean("isOffline", false)

                    views.setViewVisibility(R.id.offline_dot, if (isOffline) View.VISIBLE else View.GONE)

                    if (!isLoggedIn) {
                        views.setTextViewText(R.id.txt_stat_clients, "--")
                        views.setTextViewText(R.id.txt_stat_orders, "--")
                        views.setTextViewText(R.id.txt_stat_efficiency, "--%")
                    } else {
                        // Gather stats data
                        val clients = root.optInt("clientsCount", 0)
                        val orders = root.optInt("ordersCount", 0)
                        val efficiency = root.optDouble("globalCollectionRate", 0.0)

                        if (isLocked) {
                            views.setTextViewText(R.id.txt_stat_clients, "**")
                            views.setTextViewText(R.id.txt_stat_orders, "**")
                            views.setTextViewText(R.id.txt_stat_efficiency, "**%")
                        } else {
                            views.setTextViewText(R.id.txt_stat_clients, clients.toString())
                            views.setTextViewText(R.id.txt_stat_orders, orders.toString())
                            views.setTextViewText(R.id.txt_stat_efficiency, String.format(Locale.US, "%.1f%%", efficiency))
                            
                            // Adjust efficiency color
                            if (efficiency >= 90.0) {
                                views.setTextColor(R.id.txt_stat_efficiency, 0xFF34C759.toInt()) // Green
                            } else if (efficiency >= 75.0) {
                                views.setTextColor(R.id.txt_stat_efficiency, 0xFFFFCC00.toInt()) // Yellow/Amber
                            } else {
                                views.setTextColor(R.id.txt_stat_efficiency, 0xFFFF3B30.toInt()) // Red
                            }
                        }
                    }
                } catch (e: Exception) {
                    renderDefaultState(views, isLocked)
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }

    private fun renderDefaultState(views: RemoteViews, isLocked: Boolean) {
        views.setTextViewText(R.id.txt_stat_clients, if (isLocked) "**" else "0")
        views.setTextViewText(R.id.txt_stat_orders, if (isLocked) "**" else "0")
        views.setTextViewText(R.id.txt_stat_efficiency, if (isLocked) "**%" else "0.0%")
    }
}
