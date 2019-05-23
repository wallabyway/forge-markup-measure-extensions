'use strict';

import { EditAction } from './EditAction'
import { CreateCloud } from './CreateCloud'

    /**
     *
     * @param editor
     * @param cloud
     * @constructor
     */
    export function DeleteCloud(editor, cloud) {

        EditAction.call(this, editor, 'DELETE-CLOUD', cloud.id);
        this.createCloud = new CreateCloud(
            editor,
            cloud.id,
            cloud.position,
            cloud.size,
            cloud.rotation,
            cloud.getStyle());
    }

    DeleteCloud.prototype = Object.create(EditAction.prototype);
    DeleteCloud.prototype.constructor = DeleteCloud;

    var proto = DeleteCloud.prototype;

    proto.redo = function() {

        this.createCloud.undo();
    };

    proto.undo = function() {

        this.createCloud.redo();
    };

