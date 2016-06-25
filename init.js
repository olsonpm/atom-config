'use strict';


//---------//
// Imports //
//---------//

const path = require('path')
  , fp = require('lodash/fp');


//------//
// Main //
//------//

atom.commands.add('atom-text-editor', 'personal:doc-curline', function() {
  const editor = atom.workspace.getActiveTextEditor()
    , row = editor.getCursorBufferPosition().row;

  doc(editor.lineTextForBufferRow(row));
  editor.insertText('\n');
  editor.moveUp(1);
});

atom.commands.add('atom-text-editor', 'personal:toKebabCase', function() {
  const editor = atom.workspace.getActiveTextEditor()
    , selected = editor.getSelectedText();

  editor.insertText(fp.kebabCase(selected));
});

atom.commands.add('atom-text-editor', 'personal:doc-import', function() {
  doc('Imports');
});
atom.commands.add('atom-text-editor', 'personal:doc-export', function() {
  doc('Exports');
});
atom.commands.add('atom-text-editor', 'personal:doc-main', function() {
  doc('Main');
});
atom.commands.add('atom-text-editor', 'personal:doc-init', function() {
  doc('Init');
});
atom.commands.add('atom-text-editor', 'personal:doc-helper', function() {
  doc('Helper Fxns');
});


//-------------//
// Helper Fxns //
//-------------//

function doc(str) {
  const editor = atom.workspace.getActiveTextEditor();

  // validate
  let commentStr
    , buf = editor.getBuffer()
    , filePath = fp.invoke('getPath', buf);

  if (!filePath) {
    return;
  }

  let fileExt = path.extname(filePath).slice(1);
  if (!fileExt) {
    let firstLine = editor.lineTextForBufferRow(0);
    if (firstLine.match(/^#!.*(|ba|z)sh$/)) {
      fileExt = 'sh';
    }
  }

  switch (fileExt) {
    case 'sh':
      commentStr = '#';
      break;

    case 'js':
    case 'scss':
      commentStr = '//';
      break;

    default:
      throw new Error("Unable to document current file - extension '" + fileExt + "' is not covered");
  }

  const textLength = str.length
    , border = commentStr + fp.repeat(textLength + 2, '-') + commentStr + '\n'
    , out = border + commentStr + ' ' + str + ' ' + commentStr + '\n' + border + "\n";

  editor.deleteLine();
  editor.insertText(out);
}
