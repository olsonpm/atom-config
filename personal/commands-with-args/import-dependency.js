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
  setOfConstructorDepStrings = getSetOfConstructorDepStrings(),
  setOfPifiedDepStrings = getSetOfPifiedDepStrings();

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
    {errorMessage, method} = getImportOrRequire(importSection.text);

  if (errorMessage) {
    atom.notifications.addError(errorMessage);
    return;
  }

  // finally, no errors

  const nodeModuleOrRelative = getDepStringNodeModuleOrRelative(depString),
    varName = getVarName(depString),
    dependencyObj = {depString, varName};

  const newText = getUpdatedText(
    dependencyObj,
    importSection,
    method,
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
  dependencyObj,
  importSection,
  method,
  nodeModuleOrRelative,
  oldText
) {
  if (!importSection) {
    const declaration = methodToGetDeclaration[method](dependencyObj, 'only');
    return handleNoImportSectionCase(oldText, declaration);
  }

  const subSections = getImportSubSections(importSection.text);
  subSections[nodeModuleOrRelative].push(dependencyObj);

  const preImportSection = oldText.slice(0, importSection.startIndex),
    newImportSection = buildImportSection(method, subSections),
    postImportSection = oldText.slice(importSection.endIndex);

  return preImportSection + newImportSection + postImportSection;
}

function buildImportSection(method, {nodeModule, relative, rest}) {
  const getDeclaration = methodToGetDeclaration[method];

  let pifyStr = '';

  if (method === 'require') {
    const pifyDep = _.find(nodeModule, {depString: 'pify'});
    if (
      pifyDep ||
      _.some(nodeModule, ({depString}) => setOfPifiedDepStrings.has(depString))
    ) {
      pifyStr = getDeclaration({depString: 'pify', varName: 'pify'}, 'only');
    }

    _.pull(nodeModule, pifyDep);
  }

  return _.reject(
    [
      pifyStr,
      buildSubSection(method, nodeModule),
      buildSubSection(method, relative),
      rest.join('\n')
    ],
    _.isEmpty
  ).join('\n\n');
}

function buildSubSection(method, nodeModuleOrRelativeSubSection) {
  const toDeclaration = getDeclarationMapper(method);

  return _(nodeModuleOrRelativeSubSection)
    .sortBy(lowerCaseVarName)
    .map(toDeclaration)
    .join('\n');
}

function getDeclarationMapper(method) {
  const getDeclaration = methodToGetDeclaration[method];

  return (depObj, idx, allDepObjs) => {
    if (method === 'import') return getDeclaration(depObj);

    let variant;
    if (idx === 0) {
      variant = allDepObjs.length === 1 ? 'only' : 'first';
    } else {
      variant = idx === allDepObjs.length - 1 ? 'last' : 'middle';
    }

    return getDeclaration(depObj, variant);
  };
}

//
// returns an object with the schema
// {
//   nodeModule: [dependencyObj, ...],
//   relative: [dependencyObj, ...],
//   rest: [<string>, ...]
// }
//
// where dependencyObj has the shape
// {
//   varName: <string>,
//   depString: <string>
// }
//
function getImportSubSections(text) {
  const allLines = text.split('\n');

  let nodeModule = _.takeWhile(allLines, isEmptyOrNodeModuleLine);

  const rest = _.takeRightWhile(
    allLines,
    aLine => !isNodeModuleLine(aLine) && !isRelativeLine(aLine)
  );

  const relative = _(allLines)
    .slice(nodeModule.length, allLines.length - rest.length)
    .thru(toDependencyObjects)
    .value();

  nodeModule = toDependencyObjects(nodeModule);

  return {
    nodeModule,
    relative,
    rest
  };
}

function toDependencyObjects(lines) {
  return _(lines)
    .reject(isEmptyOrWhitespace)
    .map(aLine => ({
      depString: re.depString.exec(aLine)[1],
      varName: re.varName.exec(aLine)[1]
    }))
    .value();
}

function isEmptyOrNodeModuleLine(line) {
  return isEmptyOrWhitespace(line) || isNodeModuleLine(line);
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
    const {index} = re.firstBlankLine.exec(oldText),
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
  const getBody = ({depString, varName}) => {
      return setOfPifiedDepStrings.has(depString)
        ? `p${_.upperFirst(varName)} = pify(require('${depString}'))`
        : `${varName} = require('${depString}')`;
    },
    variantToRequire = {
      only: depObj => `const ${getBody(depObj)};`,
      first: depObj => `const ${getBody(depObj)},`,
      middle: depObj => `  ${getBody(depObj)},`,
      last: depObj => `  ${getBody(depObj)};`
    };

  return _.mapValues(
    {
      import: ({depString, varName}) =>
        `import ${varName} from '${depString}';`,
      require: (depObj, variant) => variantToRequire[variant](depObj)
    },
    returnEmptyStringWhenDepObjIsFalsey
  );
}

function getSetOfPifiedDepStrings() {
  return new Set(['fs']);
}

function returnEmptyStringWhenDepObjIsFalsey(getDeclaration) {
  return (depObj, variant) => (!depObj ? '' : getDeclaration(depObj, variant));
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
    import: /^import [a-zA-Z_$][a-zA-Z0-9_$]* from '[./\\_$\-@a-zA-Z0-9]+';?$/,
    importSection: /(\n\/\/ Imports \/\/\n.*\n\n)([\s\S]*?)\n\n\/\/\n\/\/-+\/\/\n/,
    require: /^(?:const| ) ([a-zA-Z_$][a-zA-Z0-9_$]*) = require\('([./\\_$\-@a-zA-Z0-9]+)'\)(?:,|;|)$/,
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

function lowerCaseVarName({varName}) {
  return varName.toLowerCase();
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
  return new Set(['koa', 'koa-router', 'memory-fs', 'vue', 'vue-router']);
}

function getVarName(depString) {
  const custom = depStringToVarName[depString];
  if (custom) return custom;

  if (_.endsWith(depString, 'webpack-plugin'))
    return _.flow(
      replace(/webpack-plugin$/).with('plugin'),
      _.camelCase,
      _.upperFirst
    )(depString);
  else if (setOfConstructorDepStrings.has(depString))
    return _.flow(_.camelCase, _.upperFirst)(depString);
  else return _.camelCase(path.basename(depString));
}

function replace(strOrRegexToReplace) {
  return {
    with: replacementStr => {
      return fullStr => _.replace(fullStr, strOrRegexToReplace, replacementStr);
    }
  };
}

//
//---------//
// Exports //
//---------//

module.exports = command;
