'use strict';

import { EditModePen } from './EditModePen'
import { DeleteFreehand } from '../edit-actions/DeleteFreehand'
import { CreateFreehand } from '../edit-actions/CreateFreehand'
import { SetFreehand } from '../edit-actions/SetFreehand'
import * as MarkupTypes from '../MarkupTypes'

    /**
     *
     * @param editor
     * @constructor
     */
    export function EditModeFreehand(editor) {

        var styleAttributes = ['stroke-width', 'stroke-color', 'stroke-opacity'];
        EditModePen.call(this, editor, MarkupTypes.MARKUP_TYPE_FREEHAND, styleAttributes);
    }

    EditModeFreehand.prototype = Object.create(EditModePen.prototype);
    EditModeFreehand.prototype.constructor = EditModeFreehand;

    var proto = EditModeFreehand.prototype;

    proto.createPen = function(markupId, position, size, rotation, locations) {
        return new CreateFreehand(this.editor,
            markupId,
            position,
            size,
            rotation,
            locations,
            this.style);
    };

    proto.deletePen = function(markup) {
        return new DeleteFreehand(this.editor, markup);
    };

    proto.setPen = function(position, size, locations, isAbsoluteCoords) {
        return new SetFreehand(this.editor,
            this.selectedMarkup,
            position,
            size,
            locations,
            isAbsoluteCoords);
    };

