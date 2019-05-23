'use strict';

import { EditAction } from './EditAction'

    /**
     *
     * @param editor
     * @param cloud
     * @param position
     * @param size
     * @constructor
     */
    export function SetCloud(editor, cloud, position, size) {

        EditAction.call(this, editor, 'SET-CLOUD', cloud.id);

        this.newPosition = {x: position.x, y: position.y};
        this.newSize = {x: size.x, y: size.y};
        this.oldPosition = {x: cloud.position.x, y: cloud.position.y};
        this.oldSize = {x: cloud.size.x, y: cloud.size.y};
    }

    SetCloud.prototype = Object.create(EditAction.prototype);
    SetCloud.prototype.constructor = SetCloud;

    var proto = SetCloud.prototype;

    proto.redo = function() {

        this.applyState(this.targetId, this.newPosition, this.newSize, this.newStrokeWidth, this.newColor);
    };

    proto.undo = function() {

        this.applyState(this.targetId, this.oldPosition, this.oldSize, this.oldStrokeWidth, this.oldColor);
    };

    proto.merge = function(action) {

        if (this.targetId === action.targetId &&
            this.type === action.type) {

            this.newPosition = action.newPosition;
            this.newSize = action.newSize;
            return true;
        }
        return false;
    };

    /**
     *
     * @private
     */
    proto.applyState = function(targetId, position, size) {

        var cloud = this.editor.getMarkup(targetId);
        if(!cloud) {
            return;
        }

        // Different stroke widths make positions differ at sub-pixel level.
        var epsilon = 0.0001;

        if (Math.abs(cloud.position.x - position.x) > epsilon || Math.abs(cloud.size.y - size.y) > epsilon ||
            Math.abs(cloud.position.y - position.y) > epsilon || Math.abs(cloud.size.y - size.y) > epsilon) {

            cloud.set(position, size);
        }
    };

    /**
     * @returns {boolean}
     */
    proto.isIdentity = function() {

        return (
            this.newPosition.x === this.oldPosition.x &&
            this.newPosition.y === this.oldPosition.y &&
            this.newSize.x === this.oldSize.x &&
            this.newSize.y === this.oldSize.y);
    };

