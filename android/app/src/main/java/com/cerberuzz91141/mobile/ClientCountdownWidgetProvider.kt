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
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

class ClientCountdownWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_NEXT_MONTH = "com.cerberuzz91141.mobile.ACTION_NEXT_MONTH"
        const val ACTION_PREV_MONTH = "com.cerberuzz91141.mobile.ACTION_PREV_MONTH"
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val action = intent.action
        if (action == ACTION_NEXT_MONTH || action == ACTION_PREV_MONTH) {
            val prefs = context.getSharedPreferences("spay_widget_prefs", Context.MODE_PRIVATE)
            val dataStr = prefs.getString("spay_widget_data", "") ?: ""
            
            var maxIndex = 0
            if (dataStr.isNotEmpty()) {
                try {
                    val root = JSONObject(dataStr)
                    val cycles = root.optJSONArray("billingCycles")
                    if (cycles != null) {
                        maxIndex = cycles.length() - 1
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            var currentIndex = prefs.getInt("client_selected_month_index", 0)
            if (action == ACTION_NEXT_MONTH) {
                if (currentIndex < maxIndex) {
                    currentIndex++
                }
            } else {
                if (currentIndex > 0) {
                    currentIndex--
                }
            }
            prefs.edit().putInt("client_selected_month_index", currentIndex).apply()

            // Update widget view
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisAppWidgetComponentName = ComponentName(context.packageName, javaClass.name)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(thisAppWidgetComponentName)
            onUpdate(context, appWidgetManager, appWidgetIds)
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val prefs: SharedPreferences = context.getSharedPreferences("spay_widget_prefs", Context.MODE_PRIVATE)
        val dataStr = prefs.getString("spay_widget_data", "") ?: ""
        val selectedMonthIndex = prefs.getInt("client_selected_month_index", 0)
        
        val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        val isLocked = keyguardManager.isKeyguardLocked

        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_client_countdown)

            // Setup Navigation Intent Broadcasts
            val prevIntent = Intent(context, ClientCountdownWidgetProvider::class.java).apply {
                action = ACTION_PREV_MONTH
            }
            val nextIntent = Intent(context, ClientCountdownWidgetProvider::class.java).apply {
                action = ACTION_NEXT_MONTH
            }
            
            val prevPI = PendingIntent.getBroadcast(
                context, 0, prevIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val nextPI = PendingIntent.getBroadcast(
                context, 1, nextIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            
            views.setOnClickPendingIntent(R.id.btn_prev_month, prevPI)
            views.setOnClickPendingIntent(R.id.btn_next_month, nextPI)

            // Setup Deep Link intent for "Pay Now" and General Card click
            val launchIntent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("exp+mobile://payments")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val launchPI = PendingIntent.getActivity(
                context, 2, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.btn_pay_now, launchPI)

            if (dataStr.isEmpty()) {
                // Render Empty / Default State
                renderEmptyState(views, isLocked)
            } else {
                try {
                    val root = JSONObject(dataStr)
                    
                    val isLoggedIn = root.optBoolean("isLoggedIn", false)
                    val isOffline = root.optBoolean("isOffline", false)
                    
                    // Toggle Offline warning dot
                    views.setViewVisibility(R.id.offline_dot, if (isOffline) View.VISIBLE else View.GONE)

                    if (!isLoggedIn) {
                        renderLoggedOutState(views, launchPI)
                    } else {
                        val cycles = root.optJSONArray("billingCycles")
                        if (cycles == null || cycles.length() == 0) {
                            renderAllCaughtUp(views)
                        } else {
                            // Boundary check on selected index
                            val idx = if (selectedMonthIndex >= cycles.length()) cycles.length() - 1 else selectedMonthIndex
                            val cycle = cycles.getJSONObject(idx)

                            val monthName = cycle.optString("monthName", "Billing Cycle")
                            val amountDue = cycle.optDouble("amountDue", 0.0)
                            val isOverdue = cycle.optBoolean("isOverdue", false)
                            val days = cycle.optInt("days", 0)
                            val hours = cycle.optInt("hours", 0)
                            val minutes = cycle.optInt("minutes", 0)
                            val seconds = cycle.optInt("seconds", 0)
                            val items = cycle.optJSONArray("items")

                            views.setTextViewText(R.id.txt_billing_cycle, monthName)
                            
                            // Map countdown digits
                            views.setTextViewText(R.id.txt_days, String.format(Locale.US, "%02d", days))
                            views.setTextViewText(R.id.txt_hours, String.format(Locale.US, "%02d", hours))
                            views.setTextViewText(R.id.txt_minutes, String.format(Locale.US, "%02d", minutes))
                            views.setTextViewText(R.id.txt_seconds, String.format(Locale.US, "%02d", seconds))

                            // Overdue Accent border and text colors
                            if (isOverdue) {
                                views.setTextViewText(R.id.txt_clock_status, "YOUR BILL IS OVERDUE")
                                views.setTextColor(R.id.txt_clock_status, 0xFFFF3B30.toInt())
                            } else {
                                views.setTextViewText(R.id.txt_clock_status, "Time Remaining to Settle Your Bill")
                                views.setTextColor(R.id.txt_clock_status, 0xFFFFEE4D2D.toInt())
                            }

                            // Secure Lock Screen Masking
                            if (isLocked) {
                                views.setTextViewText(R.id.txt_amount_due, "₱*****")
                            } else {
                                views.setTextViewText(R.id.txt_amount_due, String.format(Locale.US, "₱%,.2f", amountDue))
                            }

                            // Dynamic breakdown list rendering
                            views.setViewVisibility(R.id.breakdown_container, View.VISIBLE)
                            views.setViewVisibility(R.id.breakdown_row_1, View.GONE)
                            views.setViewVisibility(R.id.breakdown_row_2, View.GONE)
                            views.setViewVisibility(R.id.breakdown_row_3, View.GONE)

                            if (items != null) {
                                val count = items.length()
                                if (count > 0) {
                                    views.setViewVisibility(R.id.breakdown_row_1, View.VISIBLE)
                                    val item1 = items.getJSONObject(0)
                                    views.setTextViewText(R.id.txt_row_1_desc, item1.optString("desc"))
                                    val row1Val = if (isLocked) "₱*****" else String.format(Locale.US, "₱%,.2f", item1.optDouble("amount"))
                                    views.setTextViewText(R.id.txt_row_1_val, row1Val)
                                }
                                if (count > 1) {
                                    views.setViewVisibility(R.id.breakdown_row_2, View.VISIBLE)
                                    val item2 = items.getJSONObject(1)
                                    views.setTextViewText(R.id.txt_row_2_desc, item2.optString("desc"))
                                    val row2Val = if (isLocked) "₱*****" else String.format(Locale.US, "₱%,.2f", item2.optDouble("amount"))
                                    views.setTextViewText(R.id.txt_row_2_val, row2Val)
                                }
                                if (count > 2) {
                                    views.setViewVisibility(R.id.breakdown_row_3, View.VISIBLE)
                                    val item3 = items.getJSONObject(2)
                                    views.setTextViewText(R.id.txt_row_3_desc, item3.optString("desc"))
                                    val row3Val = if (isLocked) "₱*****" else String.format(Locale.US, "₱%,.2f", item3.optDouble("amount"))
                                    views.setTextViewText(R.id.txt_row_3_val, row3Val)
                                }
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
        views.setTextViewText(R.id.txt_billing_cycle, "S-Pay V2")
        views.setTextViewText(R.id.txt_days, "00")
        views.setTextViewText(R.id.txt_hours, "00")
        views.setTextViewText(R.id.txt_minutes, "00")
        views.setTextViewText(R.id.txt_seconds, "00")
        views.setTextViewText(R.id.txt_clock_status, "Connect to sync your payments")
        views.setTextViewText(R.id.txt_amount_due, if (isLocked) "₱*****" else "₱0.00")
        views.setViewVisibility(R.id.breakdown_container, View.GONE)
    }

    private fun renderLoggedOutState(views: RemoteViews, launchPI: PendingIntent) {
        views.setTextViewText(R.id.txt_billing_cycle, "Logged Out")
        views.setTextViewText(R.id.txt_days, "--")
        views.setTextViewText(R.id.txt_hours, "--")
        views.setTextViewText(R.id.txt_minutes, "--")
        views.setTextViewText(R.id.txt_seconds, "--")
        views.setTextViewText(R.id.txt_clock_status, "Please log in to S-Pay V2 App")
        views.setTextViewText(R.id.txt_amount_due, "₱*****")
        views.setViewVisibility(R.id.breakdown_container, View.GONE)
        views.setOnClickPendingIntent(R.id.btn_pay_now, launchPI)
    }

    private fun renderAllCaughtUp(views: RemoteViews) {
        views.setTextViewText(R.id.txt_billing_cycle, "S-Pay Active")
        views.setTextViewText(R.id.txt_days, "00")
        views.setTextViewText(R.id.txt_hours, "00")
        views.setTextViewText(R.id.txt_minutes, "00")
        views.setTextViewText(R.id.txt_seconds, "00")
        views.setTextViewText(R.id.txt_clock_status, "All Accounts Caught Up")
        views.setTextViewText(R.id.txt_amount_due, "₱0.00")
        views.setViewVisibility(R.id.breakdown_container, View.GONE)
    }
}
