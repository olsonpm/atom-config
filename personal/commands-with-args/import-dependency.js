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

const depStringToVarName = getDepStringToVarName(),
  methodToGetDeclaration = getMethodToGetDeclaration(),
  importsHeader = getImportsHeader(),
  re = getRegexes(),
  setOfConstructorDepStrings = getSetOfConstructorDepStrings();

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

  const oldPosition = editor.getCursorBufferPosition(),
    oldText = editor.getText(),
    importSection = getImportSection(oldText),
    { errorMessage, method } = getImportOrRequire(importSection.text);

  if (errorMessage) {
    atom.notifications.addError(errorMessage);
    return;
  }

  // finally, no errors

  const nodeModuleOrRelative = getDepStringNodeModuleOrRelative(depString),
    varName = getVarName(depString),
    declaration = methodToGetDeclaration[method](depString, varName);

  const newText = getUpdatedText(
    declaration,
    importSection,
    nodeModuleOrRelative,
    oldText
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
  oldText
) {
  if (!importSection) {
    return handleNoImportSectionCase(oldText, declaration);
  }

  const subSections = getImportSubSections(importSection.text);
  subSections[nodeModuleOrRelative].push(declaration);

  const preImportSection = oldText.slice(0, importSection.startIndex),
    newImportSection = buildImportSection(subSections),
    postImportSection = oldText.slice(importSection.endIndex);

  return preImportSection + newImportSection + postImportSection;
}

function buildImportSection(subSections) {
  return _.reject(
    [
      sanitizeSubSection(subSections.nodeModule),
      sanitizeSubSection(subSections.relative),
      subSections.rest.join('\n')
    ],
    _.isEmpty
  ).join('\n\n');
}

function sanitizeSubSection(nodeModuleOrRelativeSubSection) {
  return _(nodeModuleOrRelativeSubSection)
    .sortBy(byVarName)
    .map(sanitizeDeclaration)
    .join('\n');
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
    rest = _(allLines)
      .takeRightWhile(
        aLine => !isNodeModuleLine(aLine) && !isRelativeLine(aLine)
      )
      .dropWhile(isEmptyOrWhitespace)
      .value(),
    relative = _(allLines)
      .slice(nodeModule.length, allLines.length - rest.length)
      .dropWhile(isEmptyOrWhitespace)
      .value();

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

  const firstLine = importSectionText.split('\n')[0],
    isRequire = re.require.test(firstLine),
    isImport = re.import.test(firstLine);

  if (!isRequire && !isImport) {
    return {
      errorMessage:
        "The import section's first line must either be a require or an import\n\n" +
        `importSectionText\n\n${importSectionText}\n\n`
    };
  }

  return {
    method: isRequire ? 'require' : 'import'
  };
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
    importSection: /(\n\/\/ Imports \/\/\n.*\n\n)([\s\S]*?)\n\n\/\/\n\/\/-+\/\/\n/,
    require: /^(?:const| ) ([a-zA-Z_$][a-zA-Z0-9_$]*) = require\('([./\\_$\-@a-zA-Z0-9]+)'\)(?:,|;)$/,
    varName: /^(?:import|const| ) ([a-zA-Z_$][a-zA-Z0-9_$]*) /
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

function isEmptyOrWhitespace(str) {
  return !str || /^\s*$/.test(str);
}

function byVarName(line) {
  return re.varName.exec(line)[1].toLowerCase();
}

function getDepStringToVarName() {
  return {
    lodash: '_',
    koa: 'Koa',
    'koa-router': 'KoaRouter',
    vue: 'Vue'
  };
}

function getSetOfConstructorDepStrings() {
  return new Set(['koa', 'koa-router', 'vue']);
}

function getVarName(depString) {
  const custom = depStringToVarName[depString];
  if (custom) return custom;

  if (setOfConstructorDepStrings.has(depString))
    return _.flow(_.camelCase, _.upperFirst)(depString);

  return _.camelCase(path.basename(depString));
}

//
//---------//
// Exports //
//---------//

module.exports = command;
