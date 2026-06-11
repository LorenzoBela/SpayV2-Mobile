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

class ClientHealthWidgetProvider : AppWidgetProvider() {

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
            val views = RemoteViews(context.packageName, R.layout.widget_client_health)

            // Setup deep link to ReportsScreen
            val launchIntent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("exp+mobile://reports")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val launchPI = PendingIntent.getActivity(
                context, 20, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.txt_score_value, launchPI)

            if (dataStr.isEmpty()) {
                renderDefaultState(views, isLocked)
            } else {
                try {
                    val root = JSONObject(dataStr)
                    val isLoggedIn = root.optBoolean("isLoggedIn", false)
                    val isOffline = root.optBoolean("isOffline", false)

                    views.setViewVisibility(R.id.offline_dot, if (isOffline) View.VISIBLE else View.GONE)

                    if (!isLoggedIn) {
                        views.setTextViewText(R.id.txt_score_value, "--")
                        views.setTextViewText(R.id.txt_streak_value, "Logged Out")
                        views.setTextViewText(R.id.txt_health_tier, "N/A")
                    } else {
                        // Extract credit health data
                        val score = root.optInt("creditHealthScore", 85)
                        val streak = root.optInt("repaymentStreak", 0)
                        val tier = root.optString("healthTier", "Bronze")

                        if (isLocked) {
                            views.setTextViewText(R.id.txt_score_value, "**")
                            views.setTextViewText(R.id.txt_streak_value, "Streak: ** months")
                            views.setTextViewText(R.id.txt_health_tier, "****")
                        } else {
                            views.setTextViewText(R.id.txt_score_value, score.toString())
                            views.setTextViewText(R.id.txt_streak_value, "Streak: $streak months")
                            views.setTextViewText(R.id.txt_health_tier, tier.uppercase())

                            // Set tier-specific color
                            val tierColor = when (tier.lowercase()) {
                                "diamond" -> 0xFF8BE9FD.toInt() // Cyan/Light Blue
                                "platinum" -> 0xFFE2E8F0.toInt() // Platinum/Silver
                                "gold" -> 0xFFFFD700.toInt() // Golden
                                "silver" -> 0xFFC0C0C0.toInt() // Silver
                                "bronze" -> 0xFFCD7F32.toInt() // Bronze
                                else -> 0xFFFFEE4D2D.toInt() // Brand Orange
                            }
                            views.setTextColor(R.id.txt_health_tier, tierColor)
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
        views.setTextViewText(R.id.txt_score_value, "--")
        views.setTextViewText(R.id.txt_streak_value, if (isLocked) "Streak: ** months" else "Streak: 0 months")
        views.setTextViewText(R.id.txt_health_tier, "BRONZE")
        views.setTextColor(R.id.txt_health_tier, 0xFFCD7F32.toInt())
    }
}
