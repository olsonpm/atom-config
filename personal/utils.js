'use strict';

//
//------//
// Main //
//------//

const jlog = str => `console.log('${str}: ' + ${jstring(str)})`;

const jstring = str => `JSON.stringify(${str}, null, 2)`;

//
//---------//
// Exports //
//---------//

module.exports = { jlog, jstring };
