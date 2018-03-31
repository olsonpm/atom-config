'use strict'

//---------//
// Imports //
//---------//

const fp = require('lodash/fp'),
  fs = require('fs'),
  path = require('path'),
  prettier = require('prettier'),
  runCommandWithArgs = require('./personal/run-command-with-args')

const { prettier: prettierConfig } = require('./package.json')

//
//------//
// Init //
//------//

const each = getEach(),
  docVariantToHeader = getDocVariantToHeader(),
  fileExtensionToCommentString = getFileExtensionToCommentString(),
  toExportLine = fp.flow(getDefaultNameAndFromFilename, __toExportLine),
  toImportLine = fp.flow(getDefaultNameAndFromFilename, __toImportLine)

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

    const currentDirectory = path.dirname(filePath),
      supportedExtensions = new Set(['.js', '.mjs', '.vue'])

    const text = fp.flow(
      fp.filter(fp.flow(getExtension, ext => supportedExtensions.has(ext))),
      fp.pullAll(['index.js', 'index.mjs']),
      fp.map(toExportLine),
      fp.invoke('sort'),
      fp.join('\n')
    )(fs.readdirSync(currentDirectory))

    editor.setText(prettier.format(text, prettierConfig))
  }
)

atom.commands.add(
  'atom-text-editor',
  'personal:exportDefaultOfAllFilesInDirectory',
  () => {
    const editor = atom.workspace.getActiveTextEditor()

    // validate
    const buf = editor.getBuffer(),
      filePath = fp.invoke('getPath', buf)

    if (!fp.endsWith('/index.js')) return

    const currentDirectory = path.dirname(filePath),
      supportedExtensions = new Set(['.js', '.mjs', '.vue'])

    const imports = fp.flow(
      fp.filter(fp.flow(getExtension, ext => supportedExtensions.has(ext))),
      fp.pull('index.js'),
      fp.map(toImportLine),
      fp.invoke('sort')
    )(fs.readdirSync(currentDirectory))

    const exports = fp.flow(fp.map(toDefaultName), toExportAllLine)(imports)

    const text = imports.join('\n') + '\n\n' + exports + '\n'

    editor.setText(prettier.format(text, prettierConfig))
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

function toDefaultName(anImportLine) {
  return /import ([a-zA-Z_$][a-zA-Z0-9_$]*) /.exec(anImportLine)[1]
}

function toExportAllLine(defaultNames) {
  const defaultNamesString = defaultNames.join(', ')
  return `export default { ${defaultNamesString} }`
}

function getDefaultNameAndFromFilename(filename) {
  const extension = getExtension(filename),
    extensionlessFilename = removeExtension(filename),
    defaultName = filenameToDefaultName(extensionlessFilename)

  const fromFilename =
    extension === '.js' || extension === '.json'
      ? extensionlessFilename
      : filename

  return { defaultName, fromFilename }
}

function __toExportLine({ defaultName, fromFilename }) {
  return `export { default as ${defaultName} } from './${fromFilename}'`
}

function __toImportLine({ defaultName, fromFilename }) {
  return `import ${defaultName} from './${fromFilename}'`
}

function getExtension(filename) {
  const periodIndex = filename.lastIndexOf('.')
  return filename.slice(periodIndex)
}

function removeExtension(filename) {
  const periodIndex = filename.lastIndexOf('.')
  return filename.slice(0, periodIndex)
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

function type(val) {
  if (val === null) return 'Null'

  return val === undefined
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
