'use strict';

//---------//
// Imports //
//---------//

const _ = require('lodash'),
  path = require('path');

//
//------//
// Init //
//------//

const methodToGetDeclaration = getMethodToGetDeclaration(),
  importsHeader = getImportsHeader(),
  re = getRegexes();

//
//------//
// Main //
//------//

const command = {
  displayName: 'Import Dependency',
  function: importDependency,
  args: ['Name']
};

//
//------------------//
// Helper Functions //
//------------------//

function importDependency(depString) {
  if (_.isEmpty(depString)) {
    atom.notifications.addError('String must be non-empty');
    return;
  }

  const editor = atom.workspace.getActiveTextEditor(),
    filePath = editor.getBuffer().getPath(),
    fileExt = path.extname(filePath).slice(1);

  if (fileExt !== 'js') {
    atom.notifications.addError(
      `File extension '.${fileExt}' is not supported`
    );
    return;
  }

  // no errors woo woo

  const oldPosition = editor.getCursorBufferPosition(),
    oldText = editor.getText(),
    importSection = getImportSection(oldText),
    nodeModuleOrRelative = getDepStringNodeModuleOrRelative(depString),
    method = getImportOrRequire(importSection.text),
    varName = _.camelCase(path.basename(depString)),
    declaration = methodToGetDeclaration[method](depString, varName);

  const newText = getUpdatedText(
    declaration,
    importSection,
    nodeModuleOrRelative,
    oldText,
    varName
  );

  editor.setText(newText);

  const newRowOffset = getNumLines(newText) - getNumLines(oldText);

  editor.setCursorBufferPosition([
    oldPosition.row + newRowOffset,
    oldPosition.column
  ]);
}

function getNumLines(str) {
  return str.split('\n').length;
}

function getDepStringNodeModuleOrRelative(depString) {
  return _.startsWith(depString, '.') ? 'relative' : 'nodeModule';
}

function getUpdatedText(
  declaration,
  importSection,
  nodeModuleOrRelative,
  oldText,
  varName
) {
  if (!importSection) {
    return handleNoImportSectionCase(oldText, declaration);
  }

  const subSections = getImportSubSections(importSection.text);

  let indexToInsert = _.findIndex(
    subSections[nodeModuleOrRelative],
    aLine => varName.localeCompare(re.varName.exec(aLine)[1]) < 0
  );
  if (indexToInsert === -1) {
    indexToInsert = subSections[nodeModuleOrRelative].length;
  }

  subSections[nodeModuleOrRelative].splice(indexToInsert, 0, declaration);

  const preImportSection = oldText.slice(0, importSection.startIndex),
    newImportSection = buildImportSection(subSections),
    postImportSection = oldText.slice(importSection.endIndex);

  return preImportSection + newImportSection + postImportSection;
}

function buildImportSection(subSections) {
  return _.reject(
    [
      subSections.nodeModule.map(sanitizeDeclaration).join('\n'),
      subSections.relative.map(sanitizeDeclaration).join('\n'),
      subSections.rest.join('\n')
    ],
    _.isEmpty
  ).join('\n\n');
}

function sanitizeDeclaration(aLine, idx, allLines) {
  if (re.import.test(aLine) || (idx === 0 && allLines.length === 1))
    return aLine;

  const varName = re.require.exec(aLine)[1],
    depString = re.require.exec(aLine)[2],
    declaration = `${varName} = require('${depString}')`;

  if (idx === 0) {
    return `const ${declaration},`;
  } else if (idx === allLines.length - 1) {
    return `  ${declaration};`;
  } else {
    return `  ${declaration},`;
  }
}

function getImportSubSections(text) {
  const allLines = text.split('\n'),
    nodeModule = _.takeWhile(allLines, isNodeModuleLine),
    rest = _.takeWhile(
      allLines,
      aLine => !isNodeModuleLine(aLine) && !isRelativeLine(aLine)
    ),
    relative = allLines.slice(nodeModule.length, allLines.length - rest.length);

  if (!_.isArray(nodeModule)) {
    throw new Error(
      'nodeModule is not an array:\n' +
        JSON.stringify(nodeModule, null, 2) +
        '\n\ntype: ' +
        typeof nodeModule
    );
  }

  if (!_.isArray(relative)) {
    throw new Error(
      'relative is not an array:\n' +
        JSON.stringify(relative, null, 2) +
        '\n\ntype: ' +
        typeof relative
    );
  }

  if (!_.isArray(rest)) {
    throw new Error(
      'rest is not an array:\n' +
        JSON.stringify(rest, null, 2) +
        '\n\ntype: ' +
        typeof rest
    );
  }

  return {
    nodeModule,
    relative,
    rest
  };
}

function isNodeModuleLine(line) {
  return (
    isSimpleDeclaration(line) &&
    getDepStringNodeModuleOrRelative(getDepString(line)) === 'nodeModule'
  );
}

function isRelativeLine(line) {
  return (
    isSimpleDeclaration(line) &&
    getDepStringNodeModuleOrRelative(getDepString(line)) === 'relative'
  );
}

function getDepString(line) {
  return isSimpleDeclaration(line) ? re.depString.exec(line)[1] : '';
}

function isSimpleDeclaration(line) {
  return re.require.test(line) || re.import.test(line);
}

function handleNoImportSectionCase(oldText, declaration) {
  let result;

  if (_.startsWith(oldText, "'use")) {
    const { index } = re.firstBlankLine.exec(oldText),
      indexAfterBlankLine = index + 2;

    result =
      oldText.slice(0, indexAfterBlankLine) +
      importsHeader +
      declaration +
      oldText +
      oldText.slice(indexAfterBlankLine);
  } else {
    result = importsHeader + declaration + oldText;
  }

  return result;
}

function getMethodToGetDeclaration() {
  return {
    import: (depString, varName) => `import ${varName} from '${depString}';`,
    require: (depString, varName) =>
      `const ${varName} = require('${depString}');`
  };
}

//
// Dirty, but works for now.  We can use an ast later if needed.
//
function getImportOrRequire(importSectionText) {
  if (!importSectionText) return 'require';

  const requireIndex = _.get(
      re.require.exec(importSectionText),
      'index',
      Infinity
    ),
    importIndex = _.get(re.import.exec(importSectionText), 'index', Infinity);

  return requireIndex < importIndex ? 'require' : 'import';
}

function getImportsHeader() {
  return `//---------//
// Imports //
//---------//

`;
}

function getRegexes() {
  return {
    depString: /.*'(.*)'.*/,
    firstBlankLine: /\n\n/,
    import: /^import [a-zA-Z_$][a-zA-Z0-9_$]* from '[./\\_$\-@a-zA-Z0-9]+';$/,
    importSection: /(\n\/\/ Imports \/\/\n.*\n\n)([\s\S]*)\n\n\/\/\n\/\/-+\/\/\n/,
    require: /^(?:const| {2},) ([a-zA-Z_$][a-zA-Z0-9_$]*) = require\('([./\\_$\-@a-zA-Z0-9]+)'\);$/,
    varName: /(?:import|const| {2},) ([a-zA-Z_$][a-zA-Z0-9_$]*) /
  };
}

//
// If successful, returns an object with the following schema
// {
//   startIndex: int
//     **relative to getimportSectionText()
//
//   endIndex: int
//     ** relative to getText()
//
//   text: string
// }
//
// returns null if no import section exists
//
function getImportSection(text) {
  const result = re.importSection.exec(text),
    [, header, content] = result;

  return {
    startIndex: result.index + header.length,
    endIndex: result.index + header.length + content.length,
    text: content
  };
}

//
//---------//
// Exports //
//---------//

module.exports = command;
