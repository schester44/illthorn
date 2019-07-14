const Character = require("../character")
const ps_list   = require("ps-list")
const Bus       = require("../bus")

// ruby /home/benjamin/gemstone/lich/lich.rb --login Ondreian --detachable-client=8003 --without-frontend
const is_lich_proc = 
  ({name, cmd})=> name == "ruby" && cmd.includes("lich.rb") && cmd.includes("--without-frontend")

const not_zero_port =
  ({port})=> port > 0

const parse_lich_cmd =
  (proc) => ({ ...proc
             , name: proc.cmd.match(/--login\s(\w+)\s/)[1]
             ,  port: proc.cmd.match(/--detachable-client=(\d+)\s/)[1]
            })

module.exports = class Autodetect {
  static async list_unsafe () {
    return (await ps_list()).filter(is_lich_proc)
  }

  static async list () {
    return Object.values((await Autodetect.list_unsafe())
      .map(parse_lich_cmd)
      .filter(not_zero_port)
      .reduce((acc, conn) => { 
        acc[conn.port] = acc[conn.port] || conn
        // higher processes should have a higher pid
        // to account for zombie processes that Lich loves 
        // to allow to linger
        if (acc[conn.port].pid < conn.pid) {
          acc[conn.port] = conn
        }
        return acc
      }, {}))
  }

  static async connect_all () {
    const connections = (await Autodetect.list()).map(opts => {
      if (Character.Connected.has(opts.name)) return

      try {
        Character.of(opts)
      } catch (err) {
        Bus.emit("error", {message: err.message, from: opts.name})
      }
    })

    await Promise.all(connections)
    Bus.emit(Bus.events.REDRAW)
  }
}
