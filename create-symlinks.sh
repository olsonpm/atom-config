#!/usr/bin/env sh

includeStyles=1
if [ "${1}" = "--exclude-styles" ] || [ "${1}" = "-e" ]; then
  includeStyles=0
  echo "excluding styles"
else
  echo "including styles"
fi

DIR="$( cd "$( dirname "${0}" )" && pwd )"

cp ~/.atom/config.cson ~/.atom/config.bak.cson 2>/dev/null
cp ~/.atom/keymap.cson ~/.atom/keymap.bak.cson 2>/dev/null
cp ~/.atom/init.js ~/.atom/init.bak.js 2>/dev/null
rm -rf ~/.atom/config.cson
rm -rf ~/.atom/keymap.cson
rm -rf ~/.atom/init.js
ln -s "${DIR}"/config.cson ~/.atom/config.cson
ln -s "${DIR}"/keymap.cson ~/.atom/keymap.cson
ln -s "${DIR}"/init.js ~/.atom/init.js

if [ ${includeStyles} = 1 ]; then
  cp ~/.atom/styles.less ~/.atom/styles.bak.less 2>/dev/null
  rm -rf ~/.atom/styles.less
  ln -s "${DIR}"/styles.less ~/.atom/styles.less
fi

echo "Finished!"
