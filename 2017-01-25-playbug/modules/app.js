'use strict'

const jQuery = window.jQuery
const CodeMirror = window.CodeMirror
const alert = window.alert

const path = require('path')

const sessions = require('./sessions')

let Session
let Doc
let CurrentBreakIndex = 0
let TextMarker

jQuery(onLoad)

// on document load
function onLoad () {
  Doc = CodeMirror(jQuery('.editor')[0], {
    value: '',
    lineNumbers: true,
    firstLineNumber: 0,
    readOnly: true,
    mode: 'javascript',
    theme: 'eclipse'
  })

  sessions.loadSession('', (err, session) => {
    if (err) return alert(err)

    Session = session
    CurrentBreakIndex = 0

    const currentBreak = Session.breaks[CurrentBreakIndex]
    showBreak(currentBreak)
  })

  jQuery('body').keydown(onKeyDown)
  jQuery('#left-arrow-button').click((event) => {
    event.preventDefault()
    event.stopPropagation()
    stepBackward()
  })
  jQuery('#right-arrow-button').click((event) => {
    event.preventDefault()
    event.stopPropagation()
    stepForward()
  })
}

function stepForward () {
  CurrentBreakIndex++
  CurrentBreakIndex = CurrentBreakIndex % Session.breaks.length
  const currentBreak = Session.breaks[CurrentBreakIndex]
  showBreak(currentBreak)
}

function stepBackward () {
  CurrentBreakIndex--
  if (CurrentBreakIndex === -1) CurrentBreakIndex = Session.breaks.length - 1
  const currentBreak = Session.breaks[CurrentBreakIndex]
  showBreak(currentBreak)
}

// handle a key down
function onKeyDown (event) {
  if (event.keyCode === 37) { // left arrow
    event.preventDefault()
    event.stopPropagation()
    stepBackward()
    return
  }

  if (event.keyCode === 39) { // right arrow
    event.preventDefault()
    event.stopPropagation()
    stepForward()
    return
  }
}

// show a breakpoint
function showBreak (aBreak) {
  const frame = aBreak.frames[0]
  showSource(frame.script, frame.line)
  showBreakInfo(aBreak)
}

// show the breakpoint info
function showBreakInfo (aBreak) {
  const jqNav = jQuery('.nav')
  const html = []

  const date = new Date(aBreak.date).toISOString().replace('T', ' - ')
  html.push(`<div class="frame-date">${date}</div>`)
  html.push('<table class="frames" cellpadding="0" cellspacing="0">')

  for (let frame of aBreak.frames) {
    const scriptName = path.basename(frame.script.url)
    html.push('<tr><td colspan=2>')
    html.push('<div class="frame-title">')
    html.push('<span class="glyphicon glyphicon glyphicon-triangle-bottom" aria-hidden="true"></span>')
    html.push(`<b>${frame.fn}()</b>`)
    html.push('&nbsp;&nbsp;')
    html.push(`<a href="#"><i title="${frame.script.url}">${scriptName}:${frame.line + 1}</i></a>`)
    html.push('</div>')

    for (let scope of frame.scopes) {
      const scopeName = scope.name ? ` - ${scope.name}()` : ''
      const scopeTitle = `scope ${scope.type}`
      html.push('<tr><td colspan=2>')
      html.push('<div class="scope-title">')
      html.push('<span class="glyphicon glyphicon glyphicon-triangle-bottom" aria-hidden="true"></span>')
      html.push(`<b>${scopeTitle}${scopeName}`)
      html.push('</div>')

      for (let aVar of scope.vars) {
        html.push('<tr>')
        html.push(`<td><span class="var-name">${aVar.name}`)

        const val = `${aVar.val}`.replace(/ /g, '&nbsp;')
        html.push(`<td><span class="var-value">${val}`)
      }
    }
    html.push('<tr><td colspan=2>&nbsp;')
  }

  html.push('</table>')

  jqNav.empty()
  jqNav.html(html.join('\n'))
}

// show the source
function showSource (script, line) {
  jQuery('.editor-name').text(script.url)

  if (TextMarker) TextMarker.clear()

  if (Doc.getValue() !== script.source) {
    Doc.setValue(script.source)
  }

  Doc.scrollIntoView({line: line, ch: 0}, window.innerHeight / 2)

  TextMarker = Doc.markText({line: line, ch: 0}, {line: line + 1, ch: 0}, {
    className: 'current-line'
  })
}
