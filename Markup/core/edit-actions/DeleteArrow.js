'use strict';

import { EditAction } from './EditAction'
import { CreateArrow } from './CreateArrow'

    /**
     *
     * @param editor
     * @param arrow
     * @constructor
     */
    export function DeleteArrow(editor, arrow) {

        // Confusing naming here. Arrow.tail is the starting point of the arrow,
        // and arrow.head is the final point. In CreateArrow the head argument
        // is the first point of the arrow and the tail argument is the second
        // point of the argument. So construct CreateArrow with the tail before
        // the head. 
        EditAction.call(this, editor, 'DELETE-ARROW', arrow.id);
        this.createArrow = new CreateArrow(
            editor,
            arrow.id,
            arrow.tail,
            arrow.head,
            arrow.getStyle());
    }

    DeleteArrow.prototype = Object.create(EditAction.prototype);
    DeleteArrow.prototype.constructor = DeleteArrow;

    var proto = DeleteArrow.prototype;

    proto.redo = function() {

        this.createArrow.undo();
    };

    proto.undo = function() {

        this.createArrow.redo();
    };
