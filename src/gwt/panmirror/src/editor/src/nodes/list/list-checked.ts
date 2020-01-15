import { Node as ProsemirrorNode, Schema, Fragment, NodeType } from 'prosemirror-model';
import { NodeView, EditorView } from 'prosemirror-view';
import { EditorState, Transaction } from 'prosemirror-state';
import { findParentNodeOfType, NodeWithPos } from 'prosemirror-utils';
import { InputRule, wrappingInputRule } from 'prosemirror-inputrules';

import { ProsemirrorCommand, EditorCommandId } from '../../api/command';
import { PandocToken, mapTokens } from '../../api/pandoc';

// custom NodeView that accomodates display / interaction with item check boxes
export class CheckedListItemNodeView implements NodeView {
  public readonly dom: HTMLElement;
  public readonly contentDOM: HTMLElement;

  private readonly node: ProsemirrorNode;
  private readonly view: EditorView;
  private readonly getPos: () => number;

  constructor(node: ProsemirrorNode, view: EditorView, getPos: () => number) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    // create root li element
    this.dom = window.document.createElement('li');
    if (node.attrs.tight) {
      this.dom.setAttribute('data-tight', 'true');
    }

    const container = window.document.createElement('div');
    container.classList.add('list-item-container');
    this.dom.appendChild(container);

    // add checkbox for checked items
    if (node.attrs.checked !== null) {
      this.dom.setAttribute('data-checked', node.attrs.checked ? 'true' : 'false');

      // checkbox for editing checked state
      const input = window.document.createElement('input');
      input.classList.add('list-item-checkbox');
      input.setAttribute('type', 'checkbox');
      input.checked = node.attrs.checked;
      input.contentEditable = 'false';
      input.disabled = !(view as any).editable;
      input.addEventListener('mousedown', (ev: Event) => {
        ev.preventDefault(); // don't steal focus
      });
      input.addEventListener('change', (ev: Event) => {
        const tr = view.state.tr;
        tr.setNodeMarkup(getPos(), node.type, {
          ...node.attrs,
          checked: (ev.target as HTMLInputElement).checked,
        });
        view.dispatch(tr);
      });
      container.appendChild(input);
    }

    // content div
    const content = window.document.createElement('div');
    content.classList.add('list-item-content');
    this.contentDOM = content;
    container.appendChild(content);
  }
}

// command to toggle checked list items
export function checkedListItemCommandFn(itemType: NodeType) {
  return (state: EditorState, dispatch?: ((tr: Transaction) => void) | undefined) => {
    const itemNode = findParentNodeOfType(itemType)(state.selection);
    if (!itemNode) {
      return false;
    }

    if (dispatch) {
      const tr = state.tr;
      if (itemNode.node.attrs.checked !== null) {
        setItemChecked(tr, itemNode, null);
      } else {
        setItemChecked(tr, itemNode, false);
      }

      dispatch(tr);
    }

    return true;
  };
}

export function checkedListItemToggleCommandFn(itemType: NodeType) {
  return (state: EditorState, dispatch?: ((tr: Transaction) => void) | undefined) => {
    const itemNode = findParentNodeOfType(itemType)(state.selection);
    if (!itemNode || itemNode.node.attrs.checked === null) {
      return false;
    }

    if (dispatch) {
      const tr = state.tr;
      setItemChecked(tr, itemNode, !itemNode.node.attrs.checked);
      dispatch(tr);
    }

    return true;
  };
}

export class CheckedListItemCommand extends ProsemirrorCommand {
  constructor(itemType: NodeType) {
    super(EditorCommandId.ListItemCheck, [], checkedListItemCommandFn(itemType));
  }

  public isActive(state: EditorState): boolean {
    if (this.isEnabled(state)) {
      const itemNode = findParentNodeOfType(state.schema.nodes.list_item)(state.selection) as NodeWithPos;
      return itemNode.node.attrs.checked !== null;
    } else {
      return false;
    }
  }
}

export class CheckedListItemToggleCommand extends ProsemirrorCommand {
  private itemType: NodeType;

  constructor(itemType: NodeType) {
    super(EditorCommandId.ListItemCheckToggle, [], checkedListItemToggleCommandFn(itemType));
    this.itemType = itemType;
  }

  public isActive(state: EditorState): boolean {
    const itemNode = findParentNodeOfType(this.itemType)(state.selection);
    return itemNode && itemNode.node.attrs.checked;
  }
}

// allow users to type [x] or [ ] to define a checked list item
export function checkedListItemInputRule() {
  return new InputRule(/\[([ x])\]\s$/, (state: EditorState, match: string[], start: number, end: number) => {
    const schema = state.schema;

    const itemNode = findParentNodeOfType(schema.nodes.list_item)(state.selection);
    if (itemNode) {
      // create transaction
      const tr = state.tr;

      // set checked
      setItemChecked(tr, itemNode, match[1]);

      // delete entered text
      tr.delete(start, end);

      // return transaction
      return tr;
    } else {
      return null;
    }
  });
}

// allow users to begin a new checked list by typing [x] or [ ] at the beginning of a line
export function checkedListInputRule(schema: Schema) {
  // regex to match checked list at the beginning of a line
  const regex = /^\s*\[([ x])\]\s$/;

  // we are going to steal the handler from the base bullet list wrapping input rule
  const baseInputRule: any = wrappingInputRule(regex, schema.nodes.bullet_list);

  return new InputRule(regex, (state: EditorState, match: string[], start: number, end: number) => {
    // call the base handler to create the bullet list
    const tr = baseInputRule.handler(state, match, start, end);
    if (tr) {
      // set the checkbox
      const itemNode = findParentNodeOfType(schema.nodes.list_item)(tr.selection);
      if (itemNode) {
        setItemChecked(tr, itemNode, match[1]);
      }

      return tr;
    } else {
      return null;
    }
  });
}

function setItemChecked(tr: Transaction, itemNode: NodeWithPos, check: null | boolean | string) {
  tr.setNodeMarkup(itemNode.pos, itemNode.node.type, {
    ...itemNode.node.attrs,
    checked: check === null ? null : typeof check === 'string' ? check === 'x' : check,
  });
}

const kCheckedListItemSentinel = '9A1CF289-30C8-493C-A639-A79B013A25F7';
const kCheckedListItemSentinelRegex = new RegExp(kCheckedListItemSentinel, 'g');
const kUncheckedListItemSentinel = '991A75E7-0987-45A4-8AFE-36BB6C067778';
const kUncheckedListItemSentinelRegex = new RegExp(kUncheckedListItemSentinel, 'g');

// prepend a check mark to the provided fragment
export function fragmentWithCheck(schema: Schema, fragment: Fragment, checked: boolean) {
  const checkedText = schema.text((checked ? kCheckedListItemSentinel : kUncheckedListItemSentinel) + ' ');
  return Fragment.from(checkedText).append(fragment);
}

export function checkedListItemMarkdownOutputFilter(markdown: string) {
  return markdown.replace(kCheckedListItemSentinelRegex, '[x]').replace(kUncheckedListItemSentinelRegex, '[ ]');
}

const kCheckedChar = '☒';
const kUncheckedChar = '☐';

export function tokensWithChecked(tokens: PandocToken[]): { checked: null | boolean; tokens: PandocToken[] } {
  // will set this flag based on inspecting the first Str token
  let checked: null | boolean | undefined;
  let lastWasChecked = false;

  // map tokens
  const mappedTokens = mapTokens(tokens, tok => {
    // if the last token was checked then strip the next space
    if (tok.t === 'Space' && lastWasChecked) {
      lastWasChecked = false;
      return {
        t: 'Str',
        c: '',
      };
    }

    // derive 'checked' from first chraracter of first Str token encountered
    // if we find checked or unchecked then set the flag and strip off
    // the first 2 chraracters (the check and the space after it)
    else if (tok.t === 'Str' && checked === undefined) {
      let text = tok.c as string;
      if (text.charAt(0) === kCheckedChar) {
        checked = true;
        lastWasChecked = true;
        text = text.slice(1);
      } else if (text.charAt(0) === kUncheckedChar) {
        checked = false;
        lastWasChecked = true;
        text = text.slice(1);
      } else {
        checked = null;
      }
      return {
        t: 'Str',
        c: text,
      };
    } else {
      return tok;
    }
  });

  // return
  return {
    checked: checked !== undefined ? checked : null,
    tokens: mappedTokens,
  };
}