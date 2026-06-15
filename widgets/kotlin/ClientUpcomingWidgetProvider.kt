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

class ClientUpcomingWidgetProvider : AppWidgetProvider() {

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
            val views = RemoteViews(context.packageName, R.layout.widget_client_upcoming)

            // Setup deep link to Calendar view
            val launchIntent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("exp+mobile://calendar")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val launchPI = PendingIntent.getActivity(
                context, 30, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.upcoming_list_container, launchPI)

            if (dataStr.isEmpty()) {
                views.setViewVisibility(R.id.txt_empty_state, View.VISIBLE)
                views.setViewVisibility(R.id.upcoming_list_container, View.GONE)
            } else {
                try {
                    val root = JSONObject(dataStr)
                    val isLoggedIn = root.optBoolean("isLoggedIn", false)
                    val isOffline = root.optBoolean("isOffline", false)

                    views.setViewVisibility(R.id.offline_dot, if (isOffline) View.VISIBLE else View.GONE)

                    if (!isLoggedIn) {
                        views.setViewVisibility(R.id.txt_empty_state, View.VISIBLE)
                        views.setTextViewText(R.id.txt_empty_state, "Please log in to view installments.")
                        views.setViewVisibility(R.id.upcoming_list_container, View.GONE)
                    } else {
                        val upcoming = root.optJSONArray("upcomingInstallments")
                        if (upcoming == null || upcoming.length() == 0) {
                            views.setViewVisibility(R.id.txt_empty_state, View.VISIBLE)
                            views.setViewVisibility(R.id.upcoming_list_container, View.GONE)
                        } else {
                            views.setViewVisibility(R.id.txt_empty_state, View.GONE)
                            views.setViewVisibility(R.id.upcoming_list_container, View.VISIBLE)

                            // Reset visibility of rows
                            views.setViewVisibility(R.id.upcoming_row_1, View.GONE)
                            views.setViewVisibility(R.id.upcoming_row_2, View.GONE)
                            views.setViewVisibility(R.id.upcoming_row_3, View.GONE)

                            val count = Math.min(upcoming.length(), 3)
                            for (i in 0 until count) {
                                val inst = upcoming.getJSONObject(i)
                                val desc = inst.optString("desc", "Installment Due")
                                val dueInfo = inst.optString("dueInfo", "Due soon")
                                val amount = inst.optDouble("amount", 0.0)
                                val isOverdue = inst.optBoolean("isOverdue", false)

                                val rowId = when(i) {
                                    0 -> R.id.upcoming_row_1
                                    1 -> R.id.upcoming_row_2
                                    else -> R.id.upcoming_row_3
                                }
                                val descId = when(i) {
                                    0 -> R.id.txt_row_1_desc
                                    1 -> R.id.txt_row_2_desc
                                    else -> R.id.txt_row_3_desc
                                }
                                val dueInfoId = when(i) {
                                    0 -> R.id.txt_row_1_due_info
                                    1 -> R.id.txt_row_2_due_info
                                    else -> R.id.txt_row_3_due_info
                                }
                                val amountId = when(i) {
                                    0 -> R.id.txt_row_1_amount
                                    1 -> R.id.txt_row_2_amount
                                    else -> R.id.txt_row_3_amount
                                }
                                val overdueBadgeId = when(i) {
                                    0 -> R.id.txt_row_1_overdue_badge
                                    1 -> R.id.txt_row_2_overdue_badge
                                    else -> R.id.txt_row_3_overdue_badge
                                }

                                views.setViewVisibility(rowId, View.VISIBLE)
                                views.setTextViewText(descId, desc)
                                views.setTextViewText(dueInfoId, dueInfo)

                                if (isOverdue) {
                                    views.setViewVisibility(overdueBadgeId, View.VISIBLE)
                                    views.setTextColor(dueInfoId, 0xFFFF3B30.toInt()) // Soft Red
                                } else {
                                    views.setViewVisibility(overdueBadgeId, View.GONE)
                                    views.setTextColor(dueInfoId, 0xFF8A99AD.toInt()) // Standard slate-gray
                                }

                                if (isLocked) {
                                    views.setTextViewText(amountId, "₱*****")
                                } else {
                                    views.setTextViewText(amountId, String.format(Locale.US, "₱%,.2f", amount))
                                }
                            }
                        }
                    }
                } catch (e: Exception) {
                    views.setViewVisibility(R.id.txt_empty_state, View.VISIBLE)
                    views.setViewVisibility(R.id.upcoming_list_container, View.GONE)
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
