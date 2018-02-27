'use strict';

//---------//
// Imports //
//---------//

const commands = require('./commands-with-args');

//
//------//
// Main //
//------//

function init() {
  atom.packages.onDidActivatePackage(pkg => {
    if (pkg.name === 'run-command-with-args') {
      pkg.mainModule.initializeCommands(commands);
    }
  });
}

//
//---------//
// Exports //
//---------//

module.exports = { init };
