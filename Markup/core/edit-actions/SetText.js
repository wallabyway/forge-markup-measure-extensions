'use strict';

import { EditAction } from './EditAction'

    /**
     *
     * @param editor
     * @param markup
     * @param position
     * @param size
     * @param text
     * @constructor
     */
    export function SetText(editor, markup, position, size, text) {

        EditAction.call(this, editor, 'SET-TEXT', markup.id);

        this.newPosition = {x: position.x, y: position.y};
        this.oldPosition = {x: markup.position.x, y: markup.position.y};
        this.newSize = {x: size.x, y: size.y};
        this.oldSize = {x: markup.size.x, y: markup.size.y};
        this.newText = text;
        this.oldText = markup.getText();
    }

    SetText.prototype = Object.create(EditAction.prototype);
    SetText.prototype.constructor = SetText;

    var proto = SetText.prototype;

    proto.redo = function() {

        var text = this.editor.getMarkup(this.targetId);
        text && text.set(this.newPosition, this.newSize, this.newText);
    };

    proto.undo = function() {

        var text = this.editor.getMarkup(this.targetId);
        text && text.set(this.oldPosition, this.oldSize, this.oldText);
    };
