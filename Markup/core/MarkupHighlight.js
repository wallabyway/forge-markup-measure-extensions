'use strict';

import { MarkupPen } from './MarkupPen'
import * as MarkupTypes from './MarkupTypes'
import { EditModeHighlight } from './edit-modes/EditModeHighlight'

    /**
     *
     * @param id
     * @param editor
     * @constructor
     */
    export function MarkupHighlight(id, editor) {

        MarkupPen.call(this, id, editor);
        this.type = MarkupTypes.MARKUP_TYPE_HIGHLIGHT;
    }

    MarkupHighlight.prototype = Object.create(MarkupPen.prototype);
    MarkupHighlight.prototype.constructor = MarkupHighlight;

    var proto = MarkupHighlight.prototype;

    proto.getEditMode = function() {

        return new EditModeHighlight(this.editor);
    };

