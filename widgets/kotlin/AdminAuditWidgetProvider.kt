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

class AdminAuditWidgetProvider : AppWidgetProvider() {

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

        val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        val isLocked = keyguardManager.isKeyguardLocked

        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_admin_audit)

            // Setup deep link to Admin Dashboard
            val launchIntent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("exp+mobile://admin/dashboard")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val launchPI = PendingIntent.getActivity(
                context, 80, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.logs_list_container, launchPI)

            if (dataStr.isEmpty()) {
                views.setViewVisibility(R.id.txt_empty_state, View.VISIBLE)
                views.setViewVisibility(R.id.logs_list_container, View.GONE)
            } else {
                try {
                    val root = JSONObject(dataStr)
                    val isLoggedIn = root.optBoolean("isLoggedIn", false)
                    val isOffline = root.optBoolean("isOffline", false)

                    views.setViewVisibility(R.id.offline_dot, if (isOffline) View.VISIBLE else View.GONE)

                    if (!isLoggedIn) {
                        views.setViewVisibility(R.id.txt_empty_state, View.VISIBLE)
                        views.setTextViewText(R.id.txt_empty_state, "Please log in to view audit logs.")
                        views.setViewVisibility(R.id.logs_list_container, View.GONE)
                    } else {
                        val logs = root.optJSONArray("adminAuditLogs")
                        if (logs == null || logs.length() == 0) {
                            views.setViewVisibility(R.id.txt_empty_state, View.VISIBLE)
                            views.setViewVisibility(R.id.logs_list_container, View.GONE)
                        } else {
                            views.setViewVisibility(R.id.txt_empty_state, View.GONE)
                            views.setViewVisibility(R.id.logs_list_container, View.VISIBLE)

                            // Reset visibility
                            views.setViewVisibility(R.id.log_row_1, View.GONE)
                            views.setViewVisibility(R.id.log_row_2, View.GONE)
                            views.setViewVisibility(R.id.log_row_3, View.GONE)

                            val count = Math.min(logs.length(), 3)
                            for (i in 0 until count) {
                                val item = logs.getJSONObject(i)
                                val message = item.optString("message", "System Action")
                                val time = item.optString("time", "")

                                val rowId = when(i) {
                                    0 -> R.id.log_row_1
                                    1 -> R.id.log_row_2
                                    else -> R.id.log_row_3
                                }
                                val messageId = when(i) {
                                    0 -> R.id.txt_row_1_message
                                    1 -> R.id.txt_row_2_message
                                    else -> R.id.txt_row_3_message
                                }
                                val timeId = when(i) {
                                    0 -> R.id.txt_row_1_time
                                    1 -> R.id.txt_row_2_time
                                    else -> R.id.txt_row_3_time
                                }

                                views.setViewVisibility(rowId, View.VISIBLE)
                                views.setTextViewText(timeId, time)

                                if (isLocked) {
                                    views.setTextViewText(messageId, "System action log details hidden.")
                                } else {
                                    views.setTextViewText(messageId, message)
                                }
                            }
                        }
                    }
                } catch (e: Exception) {
                    views.setViewVisibility(R.id.txt_empty_state, View.VISIBLE)
                    views.setViewVisibility(R.id.logs_list_container, View.GONE)
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
