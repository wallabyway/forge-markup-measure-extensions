'use strict';

import { EditAction } from './EditAction'
import { CreateCallout } from './CreateCallout'

    /**
     *
     * @param editor
     * @param text
     * @constructor
     */
    export function DeleteCallout(editor, callout) {

        EditAction.call(this, editor, 'DELETE-CALLOUT', callout.id);

        var position = {x: callout.position.x, y: callout.position.y};
        var size = {x: callout.size.x, y: callout.size.y};

        this.createCallout = new CreateCallout(
            editor,
            callout.id,
            position,
            size,
            callout.getText(),
            callout.getStyle(),
            callout.isFrameUsed);
    }

    DeleteCallout.prototype = Object.create(EditAction.prototype);
    DeleteCallout.prototype.constructor = DeleteCallout;

    var proto = DeleteCallout.prototype;

    proto.redo = function() {

        this.createCallout.undo();
    };

    proto.undo = function() {

        this.createCallout.redo();
    };

