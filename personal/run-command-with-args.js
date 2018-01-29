'use strict';

//---------//
// Imports //
//---------//

const importDependency = require('./commands-with-args/import-dependency');

//
//------//
// Main //
//------//

function init() {
  atom.packages.onDidActivatePackage(pkg => {
    if (pkg.name === 'run-command-with-args') {
      pkg.mainModule.initializeCommands([importDependency]);
    }
  });
}

//
//---------//
// Exports //
//---------//

module.exports = { init };
