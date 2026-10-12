package art.josperd.modotreino.notif

/** Estado da notificação de música (o que o app JavaScript manda). */
data class MusicState(
  val title: String = "",
  val subtitle: String = "",
  val kicker: String = "FITA",
  /** 0..7 = cor da fita; -1 = globo da rádio. */
  val art: Int = 0,
  val playing: Boolean = false,
  val live: Boolean = false,
  val position: Int = 0,
  val duration: Int = 0,
  val fav: Boolean = false,
  val skip: Boolean = true,
)

/** Estado da notificação do exercício. O app já manda os textos e as ações prontos (a lógica fica no JavaScript). */
data class WorkoutState(
  val kicker: String = "",
  val title: String = "",
  /** Texto do selo verde-limão (ex.: "Séries feitas: 2/5"). Durante o descanso, o selo vira a contagem regressiva. */
  val pill: String = "",
  /** Ilustração do exercício: nome do recurso do app (release) ou caminho de arquivo; vazio = só o personagem. */
  val image: String = "",
  /** 'vinho' = Josperd (estrela), 'loira' = Camila Camomila (flor; id técnico herdado). */
  val persona: String = "vinho",
  /** Descanso em andamento: instante (ms desde 1970) em que acaba; 0 = não está descansando. */
  val restEndsAt: Long = 0L,
  val restPaused: Boolean = false,
  val restLeft: Int = 0,
  val primaryAction: String = "serie",
  val primaryLabel: String = "",
  val secondaryAction: String = "next",
  val secondaryLabel: String = "",
)

/** Último estado enviado: o serviço lê daqui quando (re)inicia. */
object Store {
  @Volatile var music: MusicState? = null
  @Volatile var workout: WorkoutState? = null
}

/** Ponte do receptor/serviço para o JavaScript (preenchida pelo módulo enquanto o app está vivo). */
object Bus {
  @Volatile var listener: ((String, String) -> Unit)? = null
  fun dispatch(kind: String, action: String): Boolean {
    val l = listener ?: return false
    l(kind, action)
    return true
  }
}

internal fun Map<String, Any?>.str(key: String, default: String = ""): String = (this[key] as? String) ?: default
internal fun Map<String, Any?>.int(key: String, default: Int = 0): Int = (this[key] as? Number)?.toInt() ?: default
internal fun Map<String, Any?>.long(key: String, default: Long = 0L): Long = (this[key] as? Number)?.toLong() ?: default
internal fun Map<String, Any?>.bool(key: String, default: Boolean = false): Boolean = (this[key] as? Boolean) ?: default

fun musicFrom(m: Map<String, Any?>) = MusicState(
  title = m.str("title"), subtitle = m.str("subtitle"), kicker = m.str("kicker", "FITA"), art = m.int("art", 0),
  playing = m.bool("playing"), live = m.bool("live"), position = m.int("position"), duration = m.int("duration"),
  fav = m.bool("fav"), skip = m.bool("skip", true),
)

fun workoutFrom(m: Map<String, Any?>) = WorkoutState(
  kicker = m.str("kicker"), title = m.str("title"), pill = m.str("pill"), image = m.str("image"),
  persona = m.str("persona", "vinho"), restEndsAt = m.long("restEndsAt"), restPaused = m.bool("restPaused"), restLeft = m.int("restLeft"),
  primaryAction = m.str("primaryAction", "serie"), primaryLabel = m.str("primaryLabel"),
  secondaryAction = m.str("secondaryAction", "next"), secondaryLabel = m.str("secondaryLabel"),
)
