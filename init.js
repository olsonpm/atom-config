'use strict'

//---------//
// Imports //
//---------//

const fp = require('lodash/fp'),
  fs = require('fs'),
  path = require('path'),
  runCommandWithArgs = require('./personal/run-command-with-args')

//
//------//
// Init //
//------//

const type = getType(),
  each = getEach(),
  docVariantToHeader = getDocVariantToHeader(),
  fileExtensionToCommentString = getFileExtensionToCommentString()

//
//------//
// Main //
//------//

runCommandWithArgs.init()

atom.commands.add('atom-text-editor', 'personal:doc-curline', () => {
  const editor = atom.workspace.getActiveTextEditor(),
    row = editor.getCursorBufferPosition().row

  doc(editor.lineTextForBufferRow(row))
  editor.insertText('\n')
  editor.moveUp(1)
})

atom.commands.add('atom-text-editor', 'personal:toKebabCase', () => {
  const editor = atom.workspace.getActiveTextEditor(),
    selected = editor.getSelectedText()

  editor.insertText(fp.kebabCase(selected))
})

atom.commands.add('atom-text-editor', 'personal:sortSelectedLines', () => {
  const editor = atom.workspace.getActiveTextEditor()
  editor.selectLinesContainingCursors()
  const sorted = editor
    .getSelectedText()
    .split('\n')
    .sort()
    .join('\n')

  editor.insertText(sorted)
})

atom.commands.add(
  'atom-text-editor',
  'personal:reExportDirectoryOfDefaults',
  () => {
    const editor = atom.workspace.getActiveTextEditor()

    // validate
    const buf = editor.getBuffer(),
      filePath = fp.invoke('getPath', buf)

    if (!fp.endsWith('/index.js')) return

    const currentDirectory = path.dirname(filePath)

    const text = fp.flow(
      fp.filter(fp.endsWith('.js')),
      fp.pull('index.js'),
      fp.map(toExportLine),
      fp.invoke('sort'),
      fp.join('\n')
    )(fs.readdirSync(currentDirectory))

    editor.setText(text)
  }
)

each((header, variant) => {
  atom.commands.add('atom-text-editor', `personal:doc-${variant}`, () =>
    doc(header, variant)
  )
}, docVariantToHeader)

//
//-------------//
// Helper Fxns //
//-------------//

function toExportLine(filename) {
  filename = removeDotJs(filename)
  const defaultName = filenameToDefaultName(filename)
  return `export { default as ${defaultName} } from './${filename}'`
}

function removeDotJs(filename) {
  return filename.slice(0, -'.js'.length)
}

function filenameToDefaultName(filename) {
  let defaultName = ''

  for (let i = 0; i < filename.length; i += 1) {
    let character = filename[i]
    if (character === '-') {
      i += 1
      character = filename[i].toUpperCase()
    }
    defaultName += character
  }

  return defaultName
}

function doc(str, variant) {
  const editor = atom.workspace.getActiveTextEditor()

  // validate
  const buf = editor.getBuffer(),
    filePath = fp.invoke('getPath', buf)

  if (!filePath) return

  const fileExt = path.extname(filePath).slice(1) || getFromHashBang(editor)
  if (!fileExt) {
    throw new Error('Unable to discern the file extension')
  }

  const hasPrecedingCommentLineForSpacing =
    (fileExt === 'js' || fileExt === 'mjs') && variant !== 'import'

  const commentStr = fileExtensionToCommentString[fileExt]
  if (!commentStr) {
    throw new Error(
      "Unable to document current file - extension '" +
        fileExt +
        "' is not covered"
    )
  }

  // no errors - woo woo

  const textLength = str.length,
    precedingCommentStr = hasPrecedingCommentLineForSpacing
      ? commentStr + '\n'
      : '',
    border = commentStr + fp.repeat(textLength + 2, '-') + commentStr + '\n',
    out = `${precedingCommentStr}${border}${commentStr} ${str} ${commentStr}\n${border}\n`

  editor.deleteLine()
  editor.insertText(out)
}

function getCollectionTypeToEach() {
  return {
    Object: (fn, obj) => {
      Object.keys(obj).forEach(key => {
        fn(obj[key], key, obj)
      })
      return obj
    },
    Array: (fn, arr) => arr.forEach(fn),
  }
}

function getType() {
  return val =>
    val === null
      ? 'Null'
      : val === undefined
        ? 'Undefined'
        : Object.prototype.toString.call(val).slice(8, -1)
}

function getEach() {
  return fp.curryN(2, (fn, coll) => {
    getCollectionTypeToEach()[type(coll)](fn, coll)
  })
}

function getDocVariantToHeader() {
  return {
    import: 'Imports',
    export: 'Exports',
    main: 'Main',
    init: 'Init',
    helper: 'Helper Functions',
  }
}

function getFileExtensionToCommentString() {
  return {
    sh: '#',
    mjs: '//',
    js: '//',
    scss: '//',
    lua: '--',
    sql: '--',
  }
}

function getFromHashBang(editor) {
  const firstLine = editor.lineTextForBufferRow(0)
  return firstLine.match(/^#!.*(|ba|z)sh$/) ? 'sh' : ''
}
