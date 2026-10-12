package art.josperd.modotreino.notif

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Recebe os toques nos botões das notificações e repassa ao app. Se o app não está mais rodando, a notificação ficou velha e some. */
class ActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val kind = intent.getStringExtra("kind") ?: return
    val action = intent.getStringExtra("action") ?: return
    if (Bus.dispatch(kind, action)) return
    if (kind == "music") {
      Store.music = null
      try { context.stopService(Intent(context, MusicService::class.java)) } catch (e: Exception) { /* já parado */ }
      Cards.cancel(context, Cards.ID_MUSIC)
    } else {
      Store.workout = null
      Cards.cancel(context, Cards.ID_WORKOUT)
    }
  }
}
