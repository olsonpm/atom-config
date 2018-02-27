'use strict';

//---------//
// Imports //
//---------//

const fp = require('lodash/fp'),
  path = require('path'),
  runCommandWithArgs = require('./personal/run-command-with-args');

//
//------//
// Init //
//------//

const type = getType(),
  each = getEach(),
  docVariantToHeader = getDocVariantToHeader(),
  fileExtensionToCommentString = getFileExtensionToCommentString();

//
//------//
// Main //
//------//

runCommandWithArgs.init();

atom.commands.add('atom-text-editor', 'personal:doc-curline', () => {
  const editor = atom.workspace.getActiveTextEditor(),
    row = editor.getCursorBufferPosition().row;

  doc(editor.lineTextForBufferRow(row));
  editor.insertText('\n');
  editor.moveUp(1);
});

atom.commands.add('atom-text-editor', 'personal:toKebabCase', () => {
  const editor = atom.workspace.getActiveTextEditor(),
    selected = editor.getSelectedText();

  editor.insertText(fp.kebabCase(selected));
});

atom.commands.add('atom-text-editor', 'personal:sortSelectedLines', () => {
  const editor = atom.workspace.getActiveTextEditor();
  editor.selectLinesContainingCursors();
  const sorted = editor
    .getSelectedText()
    .split('\n')
    .sort()
    .join('\n');

  editor.insertText(sorted);
});

each((header, variant) => {
  atom.commands.add('atom-text-editor', `personal:doc-${variant}`, () =>
    doc(header, variant)
  );
}, docVariantToHeader);

//
//-------------//
// Helper Fxns //
//-------------//

function doc(str, variant) {
  const editor = atom.workspace.getActiveTextEditor();

  // validate
  let buf = editor.getBuffer(),
    filePath = fp.invoke('getPath', buf);

  if (!filePath) return;

  const fileExt = path.extname(filePath).slice(1) || getFromHashBang(editor);
  if (!fileExt) {
    throw new Error('Unable to discern the file extension');
  }

  const hasPrecedingCommentLineForSpacing =
    fileExt === 'js' && variant !== 'import';

  const commentStr = fileExtensionToCommentString[fileExt];
  if (!commentStr) {
    throw new Error(
      "Unable to document current file - extension '" +
        fileExt +
        "' is not covered"
    );
  }

  // no errors - woo woo

  const textLength = str.length,
    precedingCommentStr = hasPrecedingCommentLineForSpacing
      ? commentStr + '\n'
      : '',
    border = commentStr + fp.repeat(textLength + 2, '-') + commentStr + '\n',
    out = `${precedingCommentStr}${border}${commentStr} ${str} ${commentStr}\n${border}\n`;

  editor.deleteLine();
  editor.insertText(out);
}

function getCollectionTypeToEach() {
  return {
    Object: (fn, obj) => {
      Object.keys(obj).forEach(key => {
        fn(obj[key], key, obj);
      });
      return obj;
    },
    Array: (fn, arr) => arr.forEach(fn)
  };
}

function getType() {
  return val =>
    val === null
      ? 'Null'
      : val === undefined
        ? 'Undefined'
        : Object.prototype.toString.call(val).slice(8, -1);
}

function getEach() {
  return fp.curryN(2, (fn, coll) => {
    getCollectionTypeToEach()[type(coll)](fn, coll);
  });
}

function getDocVariantToHeader() {
  return {
    import: 'Imports',
    export: 'Exports',
    main: 'Main',
    init: 'Init',
    helper: 'Helper Functions'
  };
}

function getFileExtensionToCommentString() {
  return {
    sh: '#',
    js: '//',
    scss: '//',
    lua: '--',
    sql: '--'
  };
}

function getFromHashBang(editor) {
  let firstLine = editor.lineTextForBufferRow(0);
  return firstLine.match(/^#!.*(|ba|z)sh$/) ? 'sh' : '';
}
