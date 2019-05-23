'use strict';

import { EditAction } from './EditAction'
import { CreateRectangle } from './CreateRectangle'

    /**
     *
     * @param editor
     * @param rectangle
     * @constructor
     */
    export var DeleteRectangle = function(editor, rectangle) {

        EditAction.call(this, editor, 'DELETE-RECTANGLE', rectangle.id);
        this.createRectangle = new CreateRectangle(
            editor,
            rectangle.id,
            rectangle.position,
            rectangle.size,
            rectangle.rotation,
            rectangle.getStyle());
    };

    DeleteRectangle.prototype = Object.create(EditAction.prototype);
    DeleteRectangle.prototype.constructor = DeleteRectangle;

    var proto = DeleteRectangle.prototype;

    proto.redo = function() {

        this.createRectangle.undo();
    };

    proto.undo = function() {

        this.createRectangle.redo();
    };
