package art.josperd.modotreino.notif

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Ponte JavaScript ↔ notificações nativas (música e treino). Tudo é "melhor esforço": falhar aqui nunca atrapalha o treino nem a música. */
class ModoNotifModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ModoNotif")

    Events("onAction")

    OnCreate {
      Bus.listener = { kind, action -> sendEvent("onAction", mapOf("kind" to kind, "action" to action)) }
      try { Cards.ensureChannels(context) } catch (e: Exception) { /* sem contexto ainda */ }
    }

    OnDestroy {
      Bus.listener = null
    }

    /** Mostra/atualiza a notificação do player (sobe o serviço em primeiro plano na primeira vez). */
    Function("music") { data: Map<String, Any?> ->
      val s = musicFrom(data)
      Store.music = s
      try {
        ContextCompat.startForegroundService(context, Intent(context, MusicService::class.java))
        true
      } catch (e: Exception) {
        // Android não deixou subir o serviço agora (app em segundo plano): só o cartão
        try { Cards.manager(context).notify(Cards.ID_MUSIC, CardBuilder.music(context, s)); true } catch (e2: Exception) { false }
      }
    }

    Function("musicStop") {
      Store.music = null
      try { context.startService(Intent(context, MusicService::class.java).setAction(MusicService.ACTION_STOP)) } catch (e: Exception) { /* já parado */ }
      Cards.cancel(context, Cards.ID_MUSIC)
      true
    }

    Function("workout") { data: Map<String, Any?> ->
      val s = workoutFrom(data)
      Store.workout = s
      try {
        val n = try { CardBuilder.workout(context, s) } catch (e: Exception) { CardBuilder.workoutPlain(context, s) }
        Cards.manager(context).notify(Cards.ID_WORKOUT, n)
        true
      } catch (e: Exception) { false }
    }

    Function("workoutStop") {
      Store.workout = null
      Cards.cancel(context, Cards.ID_WORKOUT)
      true
    }

    /** Estado do Android para as nossas notificações (mostrado em Ajustes). */
    Function("diagnose") {
      Cards.diagnose(context)
    }

    AsyncFunction("permission") { promise: Promise ->
      if (Build.VERSION.SDK_INT < 33) {
        val on = NotificationManagerCompat.from(context).areNotificationsEnabled()
        promise.resolve(mapOf("granted" to on, "canAskAgain" to false))
      } else {
        Permissions.getPermissionsWithPermissionsManager(appContext.permissions, promise, Manifest.permission.POST_NOTIFICATIONS)
      }
    }

    AsyncFunction("requestPermission") { promise: Promise ->
      if (Build.VERSION.SDK_INT < 33) {
        val on = NotificationManagerCompat.from(context).areNotificationsEnabled()
        promise.resolve(mapOf("granted" to on, "canAskAgain" to false))
      } else {
        Permissions.askForPermissionsWithPermissionsManager(appContext.permissions, promise, Manifest.permission.POST_NOTIFICATIONS)
      }
    }

    /** Abre direto a tela de notificações deste app nas configurações do Android. */
    Function("openSettings") {
      val intent = if (Build.VERSION.SDK_INT >= 26) {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      } else {
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.packageName))
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try { context.startActivity(intent); true } catch (e: Exception) { false }
    }
  }
}
