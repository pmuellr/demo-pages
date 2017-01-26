'use strict'

exports.loadSession = loadSession

const jQuery = window.jQuery

// load a session, sending new session object in cb
function loadSession (sessionName, cb) {
  getSessionText(sessionName, (err, text) => {
    if (err) return cb(err)

    cb(null, new Session(text))
  })
}

// get the text of a session
function getSessionText (sessionName, cb) {
  const xhr = jQuery.get('api/session/my.playbug', null, (data, status) => {
    cb(null, data)
  }, 'text')

  xhr.fail((_, status, err) => {
    let message = []
    if (status) message.push(status)
    if (err) message.push(err)
    if (message.length === 0) message.push('unknown error')
    message = message.join('; ')

    cb(new Error(`error loading session ${sessionName}: ${message}`))
  })
}

class Session {
  constructor (text) {
    this.info = null
    this.breaks = []
    this.frames = {}
    this.scopes = {}
    this.vars = {}
    this.scripts = {}

    this._decodeText(text)
  }

  _decodeText (text) {
    // split JSON lines
    const lines = text.split('\n')

    for (let line of lines) {
      if (line === '') continue

      // add the appropriate record
      const record = JSON.parse(line)
      switch (record.type) {
        case 'info': this.info = record; break
        case 'script': this.scripts[record.id] = record; break
        case 'frame': this.frames[record.id] = record.frame; break
        case 'scope': this.scopes[record.id] = record.scope; break
        case 'var': this.vars[record.id] = record; break
        case 'break': this.breaks.push(record); break
      }
    }

    for (let scopeId in this.scopes) {
      const scope = this.scopes[scopeId]
      scope.vars = scope.vars.map((id) => this.vars[id])
    }

    for (let frameId in this.frames) {
      const frame = this.frames[frameId]
      frame.scopes = frame.scopes.map((id) => this.scopes[id])
      frame.script = this.scripts[frame.script]
    }

    for (let break_ of this.breaks) {
      break_.frames = break_.frames.map((id) => this.frames[id])
    }
  }
}
