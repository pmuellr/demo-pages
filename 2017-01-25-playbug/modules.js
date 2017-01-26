(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

},{"./sessions":2,"path":3}],2:[function(require,module,exports){
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
  const xhr = jQuery.get('/api/session/my.playbug', null, (data, status) => {
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

},{}],3:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))

},{"_process":4}],4:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[1])
// sourceMappingURL annotation removed by cat-source-map

//# sourceMappingURL=modules.js.map.json