'use strict';

//---------//
// Imports //
//---------//

const { jlog } = require('../utils');

//
//------//
// Main //
//------//

const command = {
  displayName: 'JLog',
  function: jlogCommand,
  args: ['Variable Name']
};

//
//------------------//
// Helper Functions //
//------------------//

function jlogCommand(variableName) {
  atom.workspace.getActiveTextEditor().insertText(jlog(variableName) + ';');
}

//
//---------//
// Exports //
//---------//

module.exports = command;
