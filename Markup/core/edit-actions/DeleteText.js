'use strict';

import { EditAction } from './EditAction'
import { CreateText } from './CreateText'

    /**
     *
     * @param editor
     * @param text
     * @constructor
     */
    export function DeleteText(editor, text) {

        EditAction.call(this, editor, 'DELETE-TEXT', text.id);

        var position = {x: text.position.x, y: text.position.y};
        var size = {x: text.size.x, y: text.size.y};

        this.createText = new CreateText(
            editor,
            text.id,
            position,
            size,
            text.getText(),
            text.getStyle());
    }

    DeleteText.prototype = Object.create(EditAction.prototype);
    DeleteText.prototype.constructor = DeleteText;

    var proto = DeleteText.prototype;

    proto.redo = function() {

        this.createText.undo();
    };

    proto.undo = function() {

        this.createText.redo();
    };
