'use strict';

const { jlog } = require('../utils');

//
//------//
// Main //
//------//

const command = {
  displayName: 'Tee',
  function: tee,
  args: ['Variable Name']
};

//
//------------------//
// Helper Functions //
//------------------//

function tee(variableName) {
  atom.workspace.getActiveTextEditor().insertText(
    variableName + ' => ' + jlog(variableName) + ' || ' + variableName
  );
}

//
//---------//
// Exports //
//---------//

module.exports = command;
