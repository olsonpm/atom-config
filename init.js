atom.commands.add('atom-text-editor', 'personal:doc-curline', function() {
  const editor = atom.workspace.getActiveTextEditor()
    , row = editor.getCursorBufferPosition().row;

  doc(editor.lineTextForBufferRow(row));
  editor.insertText('\n');
  editor.moveUp(1);
});

atom.commands.add('atom-text-editor', 'personal:doc-import', function() { doc('Imports'); });
atom.commands.add('atom-text-editor', 'personal:doc-export', function() { doc('Exports'); });
atom.commands.add('atom-text-editor', 'personal:doc-main', function() { doc('Main'); });
atom.commands.add('atom-text-editor', 'personal:doc-init', function() { doc('Init'); });
atom.commands.add('atom-text-editor', 'personal:doc-helper', function() { doc('Helper Fxns'); });



//-------------//
// Helper Fxns //
//-------------//

function doc(str) {
  const editor = atom.workspace.getActiveTextEditor()
    , textLength = str.length
    , border = '//' + repeat('-', textLength + 2) + '//\n'
    , out = border + '// ' + str + ' //\n' + border + "\n";

  editor.deleteLine();
  editor.insertText(out);
}

function repeat(str, num) {
  if (typeof str !== 'string') {
    throw new TypeError('repeat-string expects a string.');
  }

  if (num === 1) return str;
  if (num === 2) return str + str;

  var max = str.length * num;
  if (cache !== str || typeof cache === 'undefined') {
    cache = str;
    res = '';
  }

  while (max > res.length && num > 0) {
    if (num & 1) {
      res += str;
    }

    num >>= 1;
    if (!num) break;
    str += str;
  }

  return res.substr(0, max);
}
var res = '';
var cache;
