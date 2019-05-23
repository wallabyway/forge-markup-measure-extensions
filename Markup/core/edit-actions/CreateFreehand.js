'use strict';

import { EditAction } from './EditAction'
import { MarkupFreehand } from '../MarkupFreehand'
import { cloneStyle } from '../StyleUtils'

    /**
     *
     * @param editor
     * @param id
     * @param position
     * @param size
     * @param rotation
     * @param locations
     * @param style
     * @constructor
     */
    export function CreateFreehand(editor, id, position, size, rotation, locations, style) {

        EditAction.call(this, editor, 'CREATE-FREEHAND', id);

        this.selectOnExecution = false;
        this.position = position;
        this.size = size;
        this.rotation = rotation;
        this.movements = locations.slice(0);
        this.style = cloneStyle(style);
    }

    CreateFreehand.prototype = Object.create(EditAction.prototype);
    CreateFreehand.prototype.constructor = CreateFreehand;

    var proto = CreateFreehand.prototype;

    proto.redo = function() {

        var editor = this.editor;
        var freehand = new MarkupFreehand(this.targetId, editor);

        editor.addMarkup(freehand);

        freehand.set(this.position, this.size, this.movements, false);
        freehand.setRotation(this.rotation);
        freehand.setStyle(this.style);
    };

    proto.undo = function() {

        var markup = this.editor.getMarkup(this.targetId);
        markup && this.editor.removeMarkup(markup);
    };

