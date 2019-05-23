'use strict';

import { EditAction } from './EditAction'
import { CreateHighlight } from './CreateHighlight'

    /**
     *
     * @param editor
     * @param highlight
     * @constructor
     */
    export function DeleteHighlight(editor, highlight) {
        EditAction.call(this, editor, 'DELETE-HIGHLIGHT', highlight.id);
        this.createHighlight = new CreateHighlight(
            editor,
            highlight.id,
            highlight.position,
            highlight.size,
            highlight.rotation,
            highlight.locations,
            highlight.getStyle());
    }

    DeleteHighlight.prototype = Object.create(EditAction.prototype);
    DeleteHighlight.prototype.constructor = DeleteHighlight;

    var proto = DeleteHighlight.prototype;

    proto.redo = function() {

        this.createHighlight.undo();
    };

    proto.undo = function() {

        this.createHighlight.redo();
    };
