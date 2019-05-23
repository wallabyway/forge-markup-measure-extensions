'use strict';

import { EditAction } from './EditAction'
import { CreateDimension } from './CreateDimension'

    /**
     *
     * @param editor
     * @param dimension
     * @constructor
     */
    export function DeleteDimension(editor, dimension) {

        // Confusing naming here. Dimension.secondAnchor is the starting point of the dimension,
        // and dimension.firstAnchor is the final point. In CreateDimension the firstAnchor argument
        // is the first point of the dimension and the secondAnchor argument is the second
        // point of the argument. So construct CreateDimension with the secondAnchor before
        // the firstAnchor. 
        EditAction.call(this, editor, 'DELETE-DIMENSION', dimension.id);
        this.createDimension = new CreateDimension(
            editor,
            dimension.id,
            dimension.secondAnchor,
            dimension.firstAnchor,
            dimension.currentText,
            dimension.getStyle());
    }

    DeleteDimension.prototype = Object.create(EditAction.prototype);
    DeleteDimension.prototype.constructor = DeleteDimension;

    var proto = DeleteDimension.prototype;

    proto.redo = function() {

        this.createDimension.undo();
    };

    proto.undo = function() {

        this.createDimension.redo();
    };


