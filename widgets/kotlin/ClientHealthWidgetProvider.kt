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

            // Setup deep link to ReportsScreen / App Launch
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                data = Uri.parse("exp+mobile://reports")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            } ?: Intent(Intent.ACTION_VIEW, Uri.parse("exp+mobile://reports")).apply {
                setPackage(context.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val launchPI = PendingIntent.getActivity(
                context, appWidgetId, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_root, launchPI)
            views.setOnClickPendingIntent(R.id.txt_health_score, launchPI)
            views.setOnClickPendingIntent(R.id.txt_streak, launchPI)
            views.setOnClickPendingIntent(R.id.txt_tier_badge, launchPI)

            if (dataStr.isEmpty()) {
                renderDefaultState(views, isLocked, launchPI)
            } else {
                try {
                    val root = JSONObject(dataStr)
                    val isLoggedIn = root.optBoolean("isLoggedIn", false)
                    val isOffline = root.optBoolean("isOffline", false)

                    views.setViewVisibility(R.id.offline_dot, if (isOffline) View.VISIBLE else View.GONE)

                    if (!isLoggedIn) {
                        views.setTextViewText(R.id.txt_health_score, "--")
                        views.setTextViewText(R.id.txt_streak, "Logged Out")
                        views.setTextViewText(R.id.txt_tier_badge, "N/A")
                    } else {
                        val score = root.optInt("creditHealthScore", 85)
                        val streak = root.optInt("repaymentStreak", 0)
                        val tier = root.optString("healthTier", "Bronze")

                        if (isLocked) {
                            views.setTextViewText(R.id.txt_health_score, "**")
                            views.setTextViewText(R.id.txt_streak, "Streak: ** months")
                            views.setTextViewText(R.id.txt_tier_badge, "****")
                        } else {
                            views.setTextViewText(R.id.txt_health_score, score.toString())
                            views.setTextViewText(R.id.txt_streak, "🔥 $streak-month on-time streak")
                            views.setTextViewText(R.id.txt_tier_badge, tier.uppercase(Locale.US))
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
        views.setTextViewText(R.id.txt_health_score, "--")
        views.setTextViewText(R.id.txt_streak, if (isLocked) "Streak: ** months" else "Streak: 0 months")
        views.setTextViewText(R.id.txt_tier_badge, "BRONZE")
        views.setOnClickPendingIntent(R.id.widget_root, launchPI)
    }
}
