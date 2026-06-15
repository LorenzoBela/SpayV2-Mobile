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

class ClientTransactionsWidgetProvider : AppWidgetProvider() {

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
            val views = RemoteViews(context.packageName, R.layout.widget_client_transactions)

            // Setup deep link intent
            val launchIntent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("exp+mobile://payments")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val launchPI = PendingIntent.getActivity(
                context, 10, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.tx_list_container, launchPI)

            if (dataStr.isEmpty()) {
                views.setViewVisibility(R.id.txt_empty_state, View.VISIBLE)
                views.setViewVisibility(R.id.tx_list_container, View.GONE)
            } else {
                try {
                    val root = JSONObject(dataStr)
                    val isLoggedIn = root.optBoolean("isLoggedIn", false)
                    val isOffline = root.optBoolean("isOffline", false)

                    views.setViewVisibility(R.id.offline_dot, if (isOffline) View.VISIBLE else View.GONE)

                    if (!isLoggedIn) {
                        views.setViewVisibility(R.id.txt_empty_state, View.VISIBLE)
                        views.setTextViewText(R.id.txt_empty_state, "Please log in to view transactions.")
                        views.setViewVisibility(R.id.tx_list_container, View.GONE)
                    } else {
                        val txList = root.optJSONArray("recentTransactions")
                        if (txList == null || txList.length() == 0) {
                            views.setViewVisibility(R.id.txt_empty_state, View.VISIBLE)
                            views.setTextViewText(R.id.txt_empty_state, "No recent transactions.")
                            views.setViewVisibility(R.id.tx_list_container, View.GONE)
                        } else {
                            views.setViewVisibility(R.id.txt_empty_state, View.GONE)
                            views.setViewVisibility(R.id.tx_list_container, View.VISIBLE)

                            // Default all rows to GONE
                            views.setViewVisibility(R.id.tx_row_1, View.GONE)
                            views.setViewVisibility(R.id.tx_row_2, View.GONE)
                            views.setViewVisibility(R.id.tx_row_3, View.GONE)

                            val count = Math.min(txList.length(), 3)
                            for (i in 0 until count) {
                                val tx = txList.getJSONObject(i)
                                val desc = tx.optString("desc", "Repayment")
                                val date = tx.optString("date", "--/--")
                                val amount = tx.optDouble("amount", 0.0)
                                val status = tx.optString("status", "Verified") // Pending / Verified
                                
                                val rowId = when(i) {
                                    0 -> R.id.tx_row_1
                                    1 -> R.id.tx_row_2
                                    else -> R.id.tx_row_3
                                }
                                val dateId = when(i) {
                                    0 -> R.id.txt_row_1_date
                                    1 -> R.id.txt_row_2_date
                                    else -> R.id.txt_row_3_date
                                }
                                val descId = when(i) {
                                    0 -> R.id.txt_row_1_desc
                                    1 -> R.id.txt_row_2_desc
                                    else -> R.id.txt_row_3_desc
                                }
                                val statusId = when(i) {
                                    0 -> R.id.txt_row_1_status
                                    1 -> R.id.txt_row_2_status
                                    else -> R.id.txt_row_3_status
                                }
                                val amountId = when(i) {
                                    0 -> R.id.txt_row_1_amount
                                    1 -> R.id.txt_row_2_amount
                                    else -> R.id.txt_row_3_amount
                                }

                                views.setViewVisibility(rowId, View.VISIBLE)
                                views.setTextViewText(dateId, date)
                                views.setTextViewText(descId, desc)
                                views.setTextViewText(statusId, status)

                                // Dynamic status coloring
                                if (status.equals("Verified", ignoreCase = true)) {
                                    views.setTextColor(statusId, 0xFF34C759.toInt()) // Apple Green
                                } else {
                                    views.setTextColor(statusId, 0xFFFFCC00.toInt()) // Apple Yellow / Orange
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
                    views.setViewVisibility(R.id.tx_list_container, View.GONE)
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
