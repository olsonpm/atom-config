#!/usr/bin/env bash

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

cp ~/.atom/keymap.cson ~/.atom/keymap.bak.cson
cp ~/.atom/styles.less ~/.atom/styles.bak.less
rm -rf ~/.atom/keymap.cson
rm -rf ~/.atom/styles.less
ln -s "${DIR}"/keymap.cson ~/.atom/keymap.cson
ln -s "${DIR}"/styles.less ~/.atom/styles.less
