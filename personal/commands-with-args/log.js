'use strict';

//
//------//
// Main //
//------//

const command = {
  displayName: 'Log',
  function: log,
  args: ['Variable Name']
};

//
//------------------//
// Helper Functions //
//------------------//

function log(variableName) {
  atom.workspace.getActiveTextEditor().insertText(
    `console.log('${variableName}: ' + ${variableName});`
  );
}

//
//---------//
// Exports //
//---------//

module.exports = command;
