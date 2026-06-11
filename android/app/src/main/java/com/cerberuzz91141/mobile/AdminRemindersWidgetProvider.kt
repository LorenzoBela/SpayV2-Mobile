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

class AdminRemindersWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val prefs: SharedPreferences = context.getSharedPreferences("spay_widget_prefs", Context.MODE_PRIVATE)
        val dataStr = prefs.getString("spay_widget_data", "") ?: ""

        val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        val isLocked = keyguardManager.isKeyguardLocked

        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_admin_reminders)

            // Setup deep link to Admin Reminders
            val launchIntent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("exp+mobile://admin/reminders")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val launchPI = PendingIntent.getActivity(
                context, 60, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.reminders_list_container, launchPI)

            if (dataStr.isEmpty()) {
                views.setViewVisibility(R.id.txt_empty_state, View.VISIBLE)
                views.setViewVisibility(R.id.reminders_list_container, View.GONE)
            } else {
                try {
                    val root = JSONObject(dataStr)
                    val isLoggedIn = root.optBoolean("isLoggedIn", false)
                    val isOffline = root.optBoolean("isOffline", false)

                    views.setViewVisibility(R.id.offline_dot, if (isOffline) View.VISIBLE else View.GONE)

                    if (!isLoggedIn) {
                        views.setViewVisibility(R.id.txt_empty_state, View.VISIBLE)
                        views.setTextViewText(R.id.txt_empty_state, "Please log in to view reminders.")
                        views.setViewVisibility(R.id.reminders_list_container, View.GONE)
                    } else {
                        val reminders = root.optJSONArray("adminReminders")
                        if (reminders == null || reminders.length() == 0) {
                            views.setViewVisibility(R.id.txt_empty_state, View.VISIBLE)
                            views.setViewVisibility(R.id.reminders_list_container, View.GONE)
                        } else {
                            views.setViewVisibility(R.id.txt_empty_state, View.GONE)
                            views.setViewVisibility(R.id.reminders_list_container, View.VISIBLE)

                            // Reset visibility
                            views.setViewVisibility(R.id.reminder_row_1, View.GONE)
                            views.setViewVisibility(R.id.reminder_row_2, View.GONE)
                            views.setViewVisibility(R.id.reminder_row_3, View.GONE)

                            val count = Math.min(reminders.length(), 3)
                            for (i in 0 until count) {
                                val item = reminders.getJSONObject(i)
                                val title = item.optString("title", "Alert")
                                val body = item.optString("body", "")
                                val priority = item.optString("priority", "medium") // high, medium, low

                                val rowId = when(i) {
                                    0 -> R.id.reminder_row_1
                                    1 -> R.id.reminder_row_2
                                    else -> R.id.reminder_row_3
                                }
                                val titleId = when(i) {
                                    0 -> R.id.txt_row_1_title
                                    1 -> R.id.txt_row_2_title
                                    else -> R.id.txt_row_3_title
                                }
                                val bodyId = when(i) {
                                    0 -> R.id.txt_row_1_body
                                    1 -> R.id.txt_row_2_body
                                    else -> R.id.txt_row_3_body
                                }
                                val indicatorId = when(i) {
                                    0 -> R.id.indicator_row_1
                                    1 -> R.id.indicator_row_2
                                    else -> R.id.indicator_row_3
                                }

                                views.setViewVisibility(rowId, View.VISIBLE)

                                // Set priority indicator tint color
                                val tintColor = when(priority.lowercase()) {
                                    "high" -> 0xFFFF3B30.toInt() // Red
                                    "medium" -> 0xFFFF9500.toInt() // Amber/Orange
                                    else -> 0xFF34C759.toInt() // Green
                                }
                                views.setInt(indicatorId, "setBackgroundColor", tintColor)

                                if (isLocked) {
                                    views.setTextViewText(titleId, "System Alert")
                                    views.setTextViewText(bodyId, "Unlock device to view alert preview")
                                } else {
                                    views.setTextViewText(titleId, title)
                                    views.setTextViewText(bodyId, body)
                                }
                            }
                        }
                    }
                } catch (e: Exception) {
                    views.setViewVisibility(R.id.txt_empty_state, View.VISIBLE)
                    views.setViewVisibility(R.id.reminders_list_container, View.GONE)
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
