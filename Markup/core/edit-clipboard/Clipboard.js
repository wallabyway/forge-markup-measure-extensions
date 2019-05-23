'use strict';

import { CloneMarkup } from '../edit-actions/CloneMarkup'
import { addTraitEventDispatcher } from '../MarkupsCoreUtils'

    /**
     *
     * @param editor
     * @constructor
     */
    export function Clipboard(editor) {

        this.editor = editor;
        this.content = null;
        this.pastePosition = {x:0, y: 0};

        addTraitEventDispatcher(this);
    }

    var proto = Clipboard.prototype;

    proto.copy = function() {

        var selectedMarkup = this.editor.getSelection();
        if(!selectedMarkup) {
            return;
        }

        this.content = selectedMarkup.clone();
        this.pastePosition.x = selectedMarkup.position.x;
        this.pastePosition.y = selectedMarkup.position.y;
    };

    proto.cut = function() {

        var selectedMarkup = this.editor.getSelection();
        if(!selectedMarkup) {
            return;
        }

        this.copy();
        this.editor.deleteMarkup(selectedMarkup);
    };

    proto.paste = function() {

        var content = this.content;
        if(!content) {
            return;
        }

        var editor = this.editor;
        var position = this.pastePosition;
        var delta = editor.sizeFromClientToMarkups(20, 20);

        position.x += delta.x;
        position.y -= delta.y;

        var cloneMarkup = new CloneMarkup(editor, editor.getId(), content, position);
        cloneMarkup.execute();
    };
