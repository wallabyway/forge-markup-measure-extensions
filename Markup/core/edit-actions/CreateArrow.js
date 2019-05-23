'use strict';

import { EditAction } from './EditAction'
import { MarkupArrow } from '../MarkupArrow'
import { cloneStyle } from '../StyleUtils'

    /**
     * @constructor
     */
    export function CreateArrow(editor, id, head, tail, style) {

        EditAction.call(this, editor, 'CREATE-ARROW', id);

        this.selectOnExecution = false;
        this.tail = tail;
        this.head = head;
        this.style = cloneStyle(style);
    }

    CreateArrow.prototype = Object.create(EditAction.prototype);
    CreateArrow.prototype.constructor = CreateArrow;

    var proto = CreateArrow.prototype;

    proto.redo = function() {

        var editor = this.editor;
        var arrow = new MarkupArrow(this.targetId, editor);

        editor.addMarkup(arrow);

        // Confusing naming here. in arrow.set the first two numbers are
        // the point you drag from and the second two are the point you
        // drag to. So the head point is actually where the tail of the
        // arrow is positioned and the tail point is the head is positioned.

        //TODO: In MarkupArrow "set" function has tail x, tail y, head x, head y but used here in the opposite way
        arrow.set(this.head.x, this.head.y, this.tail.x, this.tail.y);
        arrow.setStyle(this.style);
    };

    proto.undo = function() {

        var markup = this.editor.getMarkup(this.targetId);
        markup && this.editor.removeMarkup(markup);
    };

