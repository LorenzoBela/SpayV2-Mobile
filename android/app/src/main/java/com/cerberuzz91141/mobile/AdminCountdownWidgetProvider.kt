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

class AdminCountdownWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_ADMIN_NEXT_MONTH = "com.cerberuzz91141.mobile.ACTION_ADMIN_NEXT_MONTH"
        const val ACTION_ADMIN_PREV_MONTH = "com.cerberuzz91141.mobile.ACTION_ADMIN_PREV_MONTH"
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val action = intent.action
        if (action == ACTION_ADMIN_NEXT_MONTH || action == ACTION_ADMIN_PREV_MONTH) {
            val prefs = context.getSharedPreferences("spay_widget_prefs", Context.MODE_PRIVATE)
            val dataStr = prefs.getString("spay_widget_data", "") ?: ""

            var maxIndex = 0
            if (dataStr.isNotEmpty()) {
                try {
                    val root = JSONObject(dataStr)
                    val cycles = root.optJSONArray("adminCycles")
                    if (cycles != null) {
                        maxIndex = cycles.length() - 1
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            var currentIndex = prefs.getInt("admin_selected_month_index", 0)
            if (action == ACTION_ADMIN_NEXT_MONTH) {
                if (currentIndex < maxIndex) {
                    currentIndex++
                }
            } else {
                if (currentIndex > 0) {
                    currentIndex--
                }
            }
            prefs.edit().putInt("admin_selected_month_index", currentIndex).apply()

            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisAppWidgetComponentName = ComponentName(context.packageName, javaClass.name)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(thisAppWidgetComponentName)
            onUpdate(context, appWidgetManager, appWidgetIds)
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val prefs: SharedPreferences = context.getSharedPreferences("spay_widget_prefs", Context.MODE_PRIVATE)
        val dataStr = prefs.getString("spay_widget_data", "") ?: ""
        val selectedMonthIndex = prefs.getInt("admin_selected_month_index", 0)

        val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        val isLocked = keyguardManager.isKeyguardLocked

        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_admin_countdown)

            // Setup Navigation Broadcasts
            val prevIntent = Intent(context, AdminCountdownWidgetProvider::class.java).apply {
                action = ACTION_ADMIN_PREV_MONTH
            }
            val nextIntent = Intent(context, AdminCountdownWidgetProvider::class.java).apply {
                action = ACTION_ADMIN_NEXT_MONTH
            }

            val prevPI = PendingIntent.getBroadcast(
                context, 100, prevIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val nextPI = PendingIntent.getBroadcast(
                context, 101, nextIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            views.setOnClickPendingIntent(R.id.btn_prev_month, prevPI)
            views.setOnClickPendingIntent(R.id.btn_next_month, nextPI)

            // Setup Deep Link intent for general click
            val launchIntent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("exp+mobile://admin/dashboard")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val launchPI = PendingIntent.getActivity(
                context, 102, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.breakdown_container, launchPI)

            if (dataStr.isEmpty()) {
                renderEmptyState(views, isLocked)
            } else {
                try {
                    val root = JSONObject(dataStr)
                    val isLoggedIn = root.optBoolean("isLoggedIn", false)
                    val isOffline = root.optBoolean("isOffline", false)

                    views.setViewVisibility(R.id.offline_dot, if (isOffline) View.VISIBLE else View.GONE)

                    if (!isLoggedIn) {
                        renderLoggedOutState(views)
                    } else {
                        val cycles = root.optJSONArray("adminCycles")
                        if (cycles == null || cycles.length() == 0) {
                            renderAllCaughtUp(views)
                        } else {
                            val idx = if (selectedMonthIndex >= cycles.length()) cycles.length() - 1 else selectedMonthIndex
                            val cycle = cycles.getJSONObject(idx)

                            val monthName = cycle.optString("monthName", "Billing Cycle")
                            val amountDue = cycle.optDouble("amountDue", 0.0)
                            val isOverdue = cycle.optBoolean("isOverdue", false)
                            val days = cycle.optInt("days", 0)
                            val hours = cycle.optInt("hours", 0)
                            val minutes = cycle.optInt("minutes", 0)
                            val seconds = cycle.optInt("seconds", 0)

                            val pendingReceipts = cycle.optInt("pendingReceipts", 0)
                            val pendingApprovals = cycle.optInt("pendingApprovals", 0)
                            val overdueAccounts = cycle.optInt("overdueAccounts", 0)

                            views.setTextViewText(R.id.txt_billing_cycle, monthName)
                            views.setTextViewText(R.id.txt_days, String.format(Locale.US, "%02d", days))
                            views.setTextViewText(R.id.txt_hours, String.format(Locale.US, "%02d", hours))
                            views.setTextViewText(R.id.txt_minutes, String.format(Locale.US, "%02d", minutes))
                            views.setTextViewText(R.id.txt_seconds, String.format(Locale.US, "%02d", seconds))

                            if (isOverdue) {
                                views.setTextViewText(R.id.txt_clock_status, "CYCLE COLLECTION DATE OVERDUE")
                                views.setTextColor(R.id.txt_clock_status, 0xFFFF3B30.toInt())
                            } else {
                                views.setTextViewText(R.id.txt_clock_status, "Collection Cycle Timeline Remaining")
                                views.setTextColor(R.id.txt_clock_status, 0xFFFFEE4D2D.toInt())
                            }

                            if (isLocked) {
                                views.setTextViewText(R.id.txt_cycle_due_amount, "₱*****")
                                views.setTextViewText(R.id.txt_row_1_val, "**")
                                views.setTextViewText(R.id.txt_row_2_val, "**")
                                views.setTextViewText(R.id.txt_row_3_val, "**")
                            } else {
                                views.setTextViewText(R.id.txt_cycle_due_amount, String.format(Locale.US, "₱%,.2f", amountDue))
                                views.setTextViewText(R.id.txt_row_1_val, pendingReceipts.toString())
                                views.setTextViewText(R.id.txt_row_2_val, pendingApprovals.toString())
                                views.setTextViewText(R.id.txt_row_3_val, overdueAccounts.toString())
                            }
                        }
                    }
                } catch (e: Exception) {
                    renderEmptyState(views, isLocked)
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }

    private fun renderEmptyState(views: RemoteViews, isLocked: Boolean) {
        views.setTextViewText(R.id.txt_billing_cycle, "S-Pay Admin")
        views.setTextViewText(R.id.txt_days, "00")
        views.setTextViewText(R.id.txt_hours, "00")
        views.setTextViewText(R.id.txt_minutes, "00")
        views.setTextViewText(R.id.txt_seconds, "00")
        views.setTextViewText(R.id.txt_clock_status, "Sync collection timelines")
        views.setTextViewText(R.id.txt_cycle_due_amount, if (isLocked) "₱*****" else "₱0.00")
    }

    private fun renderLoggedOutState(views: RemoteViews) {
        views.setTextViewText(R.id.txt_billing_cycle, "Logged Out")
        views.setTextViewText(R.id.txt_days, "--")
        views.setTextViewText(R.id.txt_hours, "--")
        views.setTextViewText(R.id.txt_minutes, "--")
        views.setTextViewText(R.id.txt_seconds, "--")
        views.setTextViewText(R.id.txt_clock_status, "Please log in to Admin workspace")
        views.setTextViewText(R.id.txt_cycle_due_amount, "₱*****")
    }

    private fun renderAllCaughtUp(views: RemoteViews) {
        views.setTextViewText(R.id.txt_billing_cycle, "S-Pay Admin")
        views.setTextViewText(R.id.txt_days, "00")
        views.setTextViewText(R.id.txt_hours, "00")
        views.setTextViewText(R.id.txt_minutes, "00")
        views.setTextViewText(R.id.txt_seconds, "00")
        views.setTextViewText(R.id.txt_clock_status, "All collections verified!")
        views.setTextViewText(R.id.txt_cycle_due_amount, "₱0.00")
    }
}
