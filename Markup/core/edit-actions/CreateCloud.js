'use strict';

import { EditAction } from './EditAction'
import { MarkupCloud } from '../MarkupCloud'
import { cloneStyle } from '../StyleUtils'

    /**
     *
     * @param editor
     * @param id
     * @param position
     * @param size
     * @param rotation
     * @param style
     * @constructor
     */
    export function CreateCloud(editor, id, position, size, rotation, style) {

        EditAction.call(this, editor, 'CREATE-CLOUD', id);

        this.selectOnExecution = false;
        this.position = {x: position.x, y: position.y};
        this.size = {x: size.x, y: size.y};
        this.rotation = rotation;
        this.style = cloneStyle(style);
    }

    CreateCloud.prototype = Object.create(EditAction.prototype);
    CreateCloud.prototype.constructor = CreateCloud;

    var proto = CreateCloud.prototype;

    proto.redo = function() {

        var editor = this.editor;
        var cloud = new MarkupCloud(this.targetId, editor);

        editor.addMarkup(cloud);

        cloud.set(this.position, this.size);
        cloud.setRotation(this.rotation);
        cloud.setStyle(this.style);
    };

    proto.undo = function() {

        var markup = this.editor.getMarkup(this.targetId);
        markup && this.editor.removeMarkup(markup);
    };
