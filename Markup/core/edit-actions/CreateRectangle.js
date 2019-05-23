'use strict';

import { EditAction } from './EditAction'
import { MarkupRectangle } from '../MarkupRectangle'
import { cloneStyle } from '../StyleUtils'

    /**
     *
     * @param editor
     * @param id
     * @param position
     * @param size
     * @param rotation
     * @param style
     * @constructor
     */
    export function CreateRectangle(editor, id, position, size, rotation, style) {

        EditAction.call(this, editor, 'CREATE-RECTANGLE', id);

        this.selectOnExecution = false;
        this.position = {x: position.x, y: position.y};
        this.size = {x: size.x, y: size.y};
        this.rotation = rotation;
        this.style = cloneStyle(style);
    }

    CreateRectangle.prototype = Object.create(EditAction.prototype);
    CreateRectangle.prototype.constructor = CreateRectangle;

    var proto = CreateRectangle.prototype;

    proto.redo = function() {

        var editor = this.editor;
        var rectangle = new MarkupRectangle(this.targetId, editor);

        editor.addMarkup(rectangle);

        rectangle.set(this.position, this.size);
        rectangle.setRotation(this.rotation);
        rectangle.setStyle(this.style);
    };

    proto.undo = function() {

        var markup = this.editor.getMarkup(this.targetId);
        markup && this.editor.removeMarkup(markup);
    };

