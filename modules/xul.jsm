/* ***** BEGIN LICENSE BLOCK *****
 * 3e Calendar
 * Copyright © 2012  Zonio s.r.o.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * ***** END LICENSE BLOCK ***** */

function createElement(document, name) {
  return document.createElementNS(
    'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
    name
  );
}

function clearMenu(element) {
  clearChildrenOfContainer(element, 'menupopup');
}

function addItemsToTree(element, cells) {
  var document = element.ownerDocument;

  var childrenElement = findContainer(element, 'treechildren');
  if (!childrenElement) {
    childrenElement = document.createElementNS(
      'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
      'treechildren'
    );
  }

  var itemElement = document.createElementNS(
    'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
    'treeitem'
  );
  if (element.tagName === 'tree') {
    itemElement.setAttribute('container', 'true');
    itemElement.setAttribute('open', 'true');
  }

  var rowElement = document.createElementNS(
    'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
    'treerow'
  );
  itemElement.appendChild(rowElement);

  cells.forEach(function(cell) {
    var cellElement = document.createElementNS(
      'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
      'treecell'
    );
    if (cell['label'] !== null) {
      cellElement.setAttribute('label', cell['label']);
    }
    if (cell['value'] !== null) {
      cellElement.setAttribute('value', cell['value']);
    }
    rowElement.appendChild(cellElement);
  });

  if (!itemElement.parentNode) {
    childrenElement.appendChild(itemElement);
  }
  if (!childrenElement.parentNode) {
    element.appendChild(childrenElement);
  }

  return itemElement;
}

function clearTree(element) {
  clearChildrenOfContainer(element, 'treechildren');
}

function findContainer(element, containerName) {
  var containerElement = element.firstChild;
  while (containerElement && (containerName !== containerElement.tagName)) {
    containerElement = containerElement.nextSibling;
  }

  return containerElement && (containerName === containerElement.tagName) ?
    containerElement :
    null;
}

function clearChildrenOfContainer(element, containerName) {
  element = findContainer(element, containerName);
  if (!element) {
    throw Components.Exception(
      "Cannot find '" + containerName + "' container element."
    );
  }

  while (element.lastChild) {
    element.removeChild(element.lastChild);
  }
}

var cal3eXul = {
  createElement: createElement,
  clearMenu: clearMenu,
  addItemsToTree: addItemsToTree,
  clearTree: clearTree
};
EXPORTED_SYMBOLS = [
  'cal3eXul'
];
