'use strict';

import { EditModePen } from './EditModePen'
import { DeleteHighlight } from '../edit-actions/DeleteHighlight'
import { CreateHighlight } from '../edit-actions/CreateHighlight'
import { SetHighlight } from '../edit-actions/SetHighlight'
import * as MarkupTypes from '../MarkupTypes'

    /**
     *
     * @param editor
     * @constructor
     */
    export function EditModeHighlight(editor) {

        var styleAttributes = ['stroke-width', 'stroke-color', 'stroke-opacity'];
        EditModePen.call(this, editor, MarkupTypes.MARKUP_TYPE_HIGHLIGHT, styleAttributes);

        var normaStrokeWidth = editor.getStrokeWidth();
        this.style['stroke-opacity'] = 0.50;
        this.style['stroke-color'] = '#ffff00';
        this.style['stroke-width'] = 4 * normaStrokeWidth; // Very Thick
    }

    EditModeHighlight.prototype = Object.create(EditModePen.prototype);
    EditModeHighlight.prototype.constructor = EditModeHighlight;

    var proto = EditModeHighlight.prototype;

    proto.createPen = function(markupId, position, size, rotation, locations) {
        return new CreateHighlight(this.editor,
            markupId,
            position,
            size,
            rotation,
            locations,
            this.style);
    };

    proto.deletePen = function(markup) {
        return new DeleteHighlight(this.editor, markup);
    };

    proto.setPen = function(position, size, locations, isAbsoluteCoords) {
        return new SetHighlight(this.editor,
            this.selectedMarkup,
            position,
            size,
            locations,
            isAbsoluteCoords);
    };

