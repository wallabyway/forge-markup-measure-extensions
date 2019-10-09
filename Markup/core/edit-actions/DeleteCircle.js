'use strict';

import { EditAction } from './EditAction'
import { CreateCircle } from './CreateCircle'

    /**
     * Markup delete circle action.
     * 
     * Implements an {@link Autodesk.Viewing.Extensions.Markups.Core.EditAction|EditAction}
     * for deleting a Circle {@link Autodesk.Viewing.Extensions.Markups.Core.Markup|Markup}.
     * Included in documentation as an example of how to create
     * a specific EditAction that deals with Markup deletion.
     * Developers are encourage to look into this class's source code and copy
     * as much code as they need. Find link to source code below.
     *
     * @tutorial feature_markup
     * @constructor
     * @memberof Autodesk.Viewing.Extensions.Markups.Core
     * @extends Autodesk.Viewing.Extensions.Markups.Core.EditAction
     *
     * @param editor
     * @param circle
     */
    export function DeleteCircle(editor, circle) {

        EditAction.call(this, editor, 'DELETE-CIRCLE', circle.id);
        this.createCircle = new CreateCircle(
            editor,
            circle.id,
            circle.position,
            circle.size,
            circle.rotation,
            circle.getStyle());
    }

    DeleteCircle.prototype = Object.create(EditAction.prototype);
    DeleteCircle.prototype.constructor = DeleteCircle;

    var proto = DeleteCircle.prototype;

    proto.redo = function() {

        this.createCircle.undo();
    };

    proto.undo = function() {

        this.createCircle.redo();
    };


