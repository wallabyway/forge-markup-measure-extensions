'use strict';

import { EditAction } from './EditAction'
import { MarkupText } from '../MarkupText'
import { cloneStyle } from '../StyleUtils'

    /**
     *
     * @param editor
     * @param id
     * @param position
     * @param size
     * @param text
     * @param style
     * @constructor
     */
    export function CreateText(editor, id, position, size, text, style ) {

        EditAction.call(this, editor, 'CREATE-TEXT', id);

        this.text = text;
        this.position = {x: position.x, y: position.y};
        this.size = {x: size.x, y: size.y};
        this.style = cloneStyle(style);
    }

    CreateText.prototype = Object.create(EditAction.prototype);
    CreateText.prototype.constructor = CreateText;

    var proto = CreateText.prototype;

    proto.redo = function () {

        var editor = this.editor;
        var position = this.position;
        var size = this.size;

        var text = new MarkupText(this.targetId, editor, size);

        editor.addMarkup(text);

        text.set(position, size, this.text);
        text.setStyle(this.style);
    };

    proto.undo = function () {

        var markup = this.editor.getMarkup(this.targetId);
        if (markup) {
            this.editor.removeMarkup(markup);
            markup.destroy();
        }
    };


