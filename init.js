'use strict';


//---------//
// Imports //
//---------//

const path = require('path')
  , fp = require('lodash/fp')
  ;


//------//
// Init //
//------//

const type = getType(),
  each = getEach(),
  docVariantToHeader = getDocVariantToHeader(),
  fileExtensionToCommentString = getFileExtensionToCommentString()
  ;


//------//
// Main //
//------//

createPersonalSnips();

atom.commands.add('atom-text-editor', 'personal:doc-curline', () => {
  const editor = atom.workspace.getActiveTextEditor()
    , row = editor.getCursorBufferPosition().row;

  doc(editor.lineTextForBufferRow(row));
  editor.insertText('\n');
  editor.moveUp(1);
});

atom.commands.add('atom-text-editor', 'personal:toKebabCase', () => {
  const editor = atom.workspace.getActiveTextEditor()
    , selected = editor.getSelectedText();

  editor.insertText(fp.kebabCase(selected));
});

atom.commands.add('atom-text-editor', 'personal:sortSelectedLines', () => {
  const editor = atom.workspace.getActiveTextEditor();
  editor.selectLinesContainingCursors();
  const sorted = editor.getSelectedText().split('\n').sort().join('\n');

  editor.insertText(sorted);
});

each((header, variant) => {
  atom.commands.add('atom-text-editor', `personal:doc-${variant}`, () => doc(header));
}, docVariantToHeader);


//-------------//
// Helper Fxns //
//-------------//

function doc(str) {
  const editor = atom.workspace.getActiveTextEditor();

  // validate
  let buf = editor.getBuffer()
    , filePath = fp.invoke('getPath', buf);

  if (!filePath) return;

  const fileExt = path.extname(filePath).slice(1) || getFromHashBang();
  if (!fileExt) {
    throw new Error("Unable to discern the file extension");
  }

  const commentStr = fileExtensionToCommentString[fileExt];
  if (!commentStr) {
    throw new Error("Unable to document current file - extension '" + fileExt + "' is not covered");
  }

  // no errors - woo woo

  const textLength = str.length
    , border = commentStr + fp.repeat(textLength + 2, '-') + commentStr + '\n'
    , out = `${border}${commentStr} ${str} ${commentStr}\n${border}\n`;

  editor.deleteLine();
  editor.insertText(out);
}

function createPersonalSnips() {
  each(
    (fn, name) => {
      atom.commands.add('atom-text-editor', 'personal:snip-' + name, function() {
        const editor = atom.workspace.getActiveTextEditor()
          , selected = editor.getSelectedText();

        editor.insertText(fn(selected));
      });
    }
    , getSnipFns()
  );
}

function getSnipFns() {
  const _jlog = str => { return "console.log('" + str + ": ' + " + jstring(str) + ")"; }
    , jstring = str => 'JSON.stringify(' + str + ', null, 2)'
    ;
  return fp.bindAll(
    ['jlog', 'tee']
    , {
      log: str => "console.log('" + str + ": ' + " + str + ");"
      , jlog: str => _jlog(str) + ';'
      , jstring
      , tee(str) { return str + ' => ' + _jlog(str) + ' || ' + str; }
    }
  );
}

function getCollectionTypeToEach() {
  return {
    Object: (fn, obj) => {
      Object.keys(obj).forEach(key => {
        fn(obj[key], key, obj);
      });
      return obj;
    }
    , Array: (fn, arr) => arr.forEach(fn)
  };
}

function getType() {
  return val => (val === null)
    ? 'Null'
    : (val === undefined)
      ? 'Undefined'
      : Object.prototype.toString.call(val).slice(8, -1)
    ;
}

function getEach() {
  return fp.curryN(
    2
    , (fn, coll) => {
      getCollectionTypeToEach()[type(coll)](fn, coll);
    }
  );
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

function getFromHashBang() {
  let firstLine = editor.lineTextForBufferRow(0);
  if (firstLine.match(/^#!.*(|ba|z)sh$/)) {
    fileExt = 'sh';
  }
}
