const m = require("mithril")
const Lens = require("../util/lens")
const Bus = require("../bus")
const { Tag } = require("@elanthia/koschei")
const Settings = require("../settings")
const TagUtil = require("../util/tag")

const makeLookup = (keys) =>
  keys.reduce(
    (acc, id) => Object.assign(acc, { [id]: 1 }),
    {}
  )

module.exports = class SessionState {
  static TAGS = makeLookup([
    "prompt",
    "right",
    "left",
    "spell",
    "compass",
    "style",
  ])

  static MODALS = ["commands"]

  static TIMERS = ["roundtime", "casttime"]

  static INJURY_IDS = makeLookup([
    "head",
    "leftEye",
    "rightEye",
    "neck",
    "chest",
    "back",
    "abdomen",
    "leftArm",
    "rightArm",
    "leftHand",
    "rightHand",
    "leftLeg",
    "rightLeg",
    "nsys",
  ])

  static ID_TAGS = makeLookup([
    "mana",
    "health",
    "stamina",
    "spirit",
    "stance",
    "mindState",
    "encumlevel",
    "ActiveSpells",
    "nextLvlPB",
    "roomName",
  ])

  static of(session) {
    return new SessionState(session)
  }

  static wants(id) {
    return id in SessionState.ID_TAGS
  }

  static consume(state, tag) {
    //console.log("state:consume(%o)", tag)
    if (tag.id && tag.id in SessionState.INJURY_IDS)
      return state.put("injuries." + tag.id, tag)
    if (tag.id && tag.id in SessionState.ID_TAGS)
      return state.put(tag.id, tag)
    if (SessionState.TAGS[tag.tagName.toLowerCase()])
      return state.put(tag.tagName.toLowerCase(), tag)
  }

  constructor(session) {
    this._session = session
    this._timers = {}
    this._modals = {}
    SessionState.MODALS.forEach(
      (modal) => (this._modals[modal] = false)
    )

    this.wire_up()
  }

  by_name(name) {
    return Object.keys(this)
      .filter(
        (key) =>
          typeof this[key] == "object" &&
          this[key].name == name
      )
      .map((key) => this[key])
  }

  wire_up() {
    const parser = this._session

    SessionState.TIMERS.forEach((tag) => {
      parser.on(tag, (val) => this.spawn_timer(val))
    })
  }

  get(prop, fallback) {
    if (prop.toString()[0] == "_") {
      throw new Error(
        `cannot change private Property(${prop})`
      )
    }

    return Lens.get(this, prop, fallback)
  }

  put(prop, val) {
    if (val instanceof Tag) val = TagUtil.to_pojo(val)
    Lens.put(this, prop, val)
    Bus.emit(Bus.events.REDRAW)
    return this
  }
  /**
   * spawns an interval based timer that will
   * update its state with seconds remaining
   *
   * examples:
   *   1. State.casttime  -> {remaining: 2}
   *   2. State.roundtime -> {remaining: 6}
   * @param {Tag} param0
   */
  spawn_timer({ name, attrs }) {
    this._timers[name] = this._timers[name] || {}
    // gs timers are second precision vs millisecond
    this._timers[name].end_epoc_time =
      parseInt(attrs.value, 10) * 1000

    this._timers[name].interval =
      this._timers[name].interval ||
      setInterval(() => {
        const end_epoc_time = this._timers[name]
          .end_epoc_time
        // dispose of the timer
        if (Date.now() > end_epoc_time) {
          clearInterval(this._timers[name].interval)
          this._timers[name] = void 0
        }

        const seconds_left = Math.max(
          0,
          Math.ceil((end_epoc_time - Date.now()) / 1000)
        )

        if (seconds_left) {
          this._timers[name].remaining = seconds_left
        }

        // Redraws don't happen on setInterval according to the docs
        // but it's an important time to redraw because a timer just started
        m.redraw()
      }, 1000 / 5) // 5 fps is more than enough for a text-based RPG
  }
}
