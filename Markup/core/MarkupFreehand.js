'use strict';

import { MarkupPen } from './MarkupPen'
import * as MarkupTypes from './MarkupTypes'
import { EditModeFreehand } from './edit-modes/EditModeFreehand'


    /**
     *
     * @param id
     * @param editor
     * @constructor
     */
    export function MarkupFreehand(id, editor) {

        MarkupPen.call(this, id, editor);
        this.type = MarkupTypes.MARKUP_TYPE_FREEHAND;
    }

    MarkupFreehand.prototype = Object.create(MarkupPen.prototype);
    MarkupFreehand.prototype.constructor = MarkupFreehand;

    var proto = MarkupFreehand.prototype;

    proto.getEditMode = function() {

        return new EditModeFreehand(this.editor);
    };

