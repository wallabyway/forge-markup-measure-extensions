'use strict';

import { EditAction } from './EditAction'
import { CreatePolycloud } from './CreatePolycloud'

    /**
     *
     * @param editor
     * @param polycloud
     * @constructor
     */
    export function DeletePolycloud(editor, polycloud) {

        EditAction.call(this, editor, 'DELETE-POLYCLOUD', polycloud.id);
        this.createPolycloud = new CreatePolycloud(
            editor,
            polycloud.id,
            polycloud.position,
            polycloud.size,
            polycloud.rotation,
            polycloud.locations,
            polycloud.getStyle(),
            polycloud.closed);
    }

    DeletePolycloud.prototype = Object.create(EditAction.prototype);
    DeletePolycloud.prototype.constructor = DeletePolycloud;

    var proto =  DeletePolycloud.prototype;

    proto.redo = function() {

        this.createPolycloud.undo();
    };

    proto.undo = function() {

        this.createPolycloud.redo();
    };
