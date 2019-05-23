'use strict';

import { EditAction } from './EditAction'
import { CreatePolyline } from './CreatePolyline'

    /**
     *
     * @param editor
     * @param polyline
     * @constructor
     */
    export function DeletePolyline(editor, polyline) {

        EditAction.call(this, editor, 'DELETE-POLYLINE', polyline.id);
        this.createPolyline = new CreatePolyline(
            editor,
            polyline.id,
            polyline.position,
            polyline.size,
            polyline.rotation,
            polyline.locations,
            polyline.getStyle(),
            polyline.closed);
    }

    DeletePolyline.prototype = Object.create(EditAction.prototype);
    DeletePolyline.prototype.constructor = DeletePolyline;

    var proto =  DeletePolyline.prototype;

    proto.redo = function() {

        this.createPolyline.undo();
    };

    proto.undo = function() {

        this.createPolyline.redo();
    };
