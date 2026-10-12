package art.josperd.modotreino.notif

import android.app.Notification
import android.content.Context
import androidx.core.app.NotificationCompat

/** Monta o objeto Notification (a única parte que usa a biblioteca androidx); os layouts vêm de [Cards]. */
object CardBuilder {
  private const val INK = 0xFF141B34.toInt()

  private fun base(ctx: Context, channel: String, title: String, text: String): NotificationCompat.Builder =
    NotificationCompat.Builder(ctx, channel)
      .setSmallIcon(R.drawable.ic_stat_tape)
      .setColor(INK)
      .setContentTitle(title)
      .setContentText(text)
      .setContentIntent(Cards.open(ctx))
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

  fun music(ctx: Context, s: MusicState): Notification {
    Cards.ensureChannels(ctx)
    val (small, big) = Cards.musicViews(ctx, s)
    return base(ctx, Cards.CH_MUSIC, s.title, s.subtitle)
      .setCustomContentView(small)
      .setCustomBigContentView(big)
      .setStyle(NotificationCompat.DecoratedCustomViewStyle())
      .setSubText("Tocando agora")
      .setColorized(true)
      .setOngoing(s.playing)
      .setDeleteIntent(Cards.deleteIntent(ctx, "music", "close"))
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .build()
  }

  /** Versão simples (sem layout próprio), usada só se o cartão falhar. */
  fun musicPlain(ctx: Context, s: MusicState): Notification {
    Cards.ensureChannels(ctx)
    return base(ctx, Cards.CH_MUSIC, s.title, s.subtitle).setOngoing(true).build()
  }

  fun workout(ctx: Context, s: WorkoutState): Notification {
    Cards.ensureChannels(ctx)
    val (small, big) = Cards.workoutViews(ctx, s)
    return base(ctx, Cards.CH_WORKOUT, s.title, s.kicker)
      .setCustomContentView(small)
      .setCustomBigContentView(big)
      .setStyle(NotificationCompat.DecoratedCustomViewStyle())
      .setSubText("Treino em andamento")
      .setColorized(true)
      .setOngoing(true)
      .setCategory(NotificationCompat.CATEGORY_STATUS)
      .setTimeoutAfter(6L * 60 * 60 * 1000)
      .build()
  }

  fun workoutPlain(ctx: Context, s: WorkoutState): Notification {
    Cards.ensureChannels(ctx)
    return base(ctx, Cards.CH_WORKOUT, s.title, s.kicker).setOngoing(true).setTimeoutAfter(6L * 60 * 60 * 1000).build()
  }
}
