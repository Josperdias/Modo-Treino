package art.josperd.modotreino.playback

/** Ponte do serviço (notificação/tela de bloqueio) para o JavaScript: o módulo registra quem escuta enquanto o app está vivo. */
object PlaybackBus {
  @Volatile var listener: ((String) -> Unit)? = null
  fun emit(action: String) { listener?.invoke(action) }
}
