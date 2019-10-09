'use strict';

import { EditAction } from './EditAction'

    /**
     * Markup set circle action.
     *
     * Implements an {@link Autodesk.Viewing.Extensions.Markups.Core.EditAction|EditAction}
     * for editing properties of a Circle {@link Autodesk.Viewing.Extensions.Markups.Core.Markup|Markup}.
     * Included in documentation as an example of how to create
     * a specific EditAction that deals with Markup edition.
     * Developers are encourage to look into this class's source code and copy
     * as much code as they need. Find link to source code below.
     *
     * @tutorial feature_markup
     * @constructor
     * @memberof Autodesk.Viewing.Extensions.Markups.Core
     * @extends Autodesk.Viewing.Extensions.Markups.Core.EditAction
     *
     * @param editor
     * @param circle
     * @param position
     * @param size
     */
    export function SetCircle(editor, circle, position, size) {

        EditAction.call(this, editor, 'SET-CIRCLE', circle.id);

        this.newPosition = {x: position.x, y: position.y};
        this.newSize = {x: size.x, y: size.y};
        this.oldPosition = {x: circle.position.x, y: circle.position.y};
        this.oldSize = {x: circle.size.x, y: circle.size.y};
    }

    SetCircle.prototype = Object.create(EditAction.prototype);
    SetCircle.prototype.constructor = SetCircle;

    var proto = SetCircle.prototype;

    proto.redo = function() {

        this.applyState(this.targetId, this.newPosition, this.newSize);
    };

    proto.undo = function() {

        this.applyState(this.targetId, this.oldPosition, this.oldSize);
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

        var circle = this.editor.getMarkup(targetId);
        if(!circle) {
            return;
        }

        // Different stroke widths make positions differ at sub-pixel level.
        var epsilon = 0.0001;

        if (Math.abs(circle.position.x - position.x) > epsilon || Math.abs(circle.size.y - size.y) > epsilon ||
            Math.abs(circle.position.y - position.y) > epsilon || Math.abs(circle.size.y - size.y) > epsilon) {

            circle.set(position, size);
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

