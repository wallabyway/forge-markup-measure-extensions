'use strict';

import { EditAction } from './EditAction'
import { MarkupPolyline } from '../MarkupPolyLine'
import { cloneStyle } from '../StyleUtils'

    /**
     *
     * @param editor
     * @param id
     * @param position
     * @param size
     * @param rotation
     * @param locations
     * @param closed
     * @param style
     * @constructor
     */
    export function CreatePolyline(editor, id, position, size, rotation, locations, style, closed) {

        EditAction.call(this, editor, 'CREATE-POLYLINE', id);

        this.selectOnExecution = false;
        this.position = position;
        this.size = size;
        this.rotation = rotation;
        this.movements = locations.concat();
        this.closed = closed;
        this.style = cloneStyle(style);
    }

    CreatePolyline.prototype = Object.create(EditAction.prototype);
    CreatePolyline.prototype.constructor = CreatePolyline;

    var proto = CreatePolyline.prototype;

    proto.redo = function() {

        var editor = this.editor;
        var polyline = new MarkupPolyline(this.targetId, editor);

        editor.addMarkup(polyline);

        polyline.set(this.position, this.size, this.movements, this.closed);
        polyline.setRotation(this.rotation);
        polyline.setStyle(this.style);
    };

    proto.undo = function() {

        var markup = this.editor.getMarkup(this.targetId);
        markup && this.editor.removeMarkup(markup);
    };

