'use strict';

import * as MarkupEvents from '../MarkupEvents'
import { createStyle, copyStyle } from '../StyleUtils'
import { addTraitEventDispatcher, removeTraitEventDispatcher, sign } from '../MarkupsCoreUtils'
import { SetStyle } from '../edit-actions/SetStyle'

const av = Autodesk.Viewing;

    /**
     * Base class for all markup edit modes.
     *
     * An EditMode is responsible for handling user input to create and edit a
     * {@link Autodesk.Viewing.Extensions.Markups.Core.Markup|Markup}.
     *
     * Any class extending Markup should contain at least the following methods:
     * - deleteMarkup()
     * - onMouseDown()
     * - onMouseMove()
     *
     * A good reference is the Circle EditMode implementation available in
     * {@link Autodesk.Viewing.Extensions.Markups.Core.EditModeCircle|EditModeCircle}.
     *
     * @tutorial feature_markup
     * @constructor
     * @memberof Autodesk.Viewing.Extensions.Markups.Core
     *
     * @param {Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore} editor - Markups extension.
     * @param {String} type - An identifier for the EditMode type. Not to be confused by the Markup's id.
     * @param {Array} styleAttributes - Attributes for customization.
     * @constructor
     */
    export function EditMode(editor, type, styleAttributes) {

        this.editor = editor;
        this.viewer = editor.viewer;
        this.setGlobalManager(this.viewer.globalManager);
        this.type = type;
        this.selectedMarkup = null;
        this.dragging = false;
        this.draggingAnnotationIniPosition = null;
        this.draggingMouseIniPosition = new THREE.Vector2();
        this.initialX = 0;
        this.initialY = 0;
        this.minSize = 9; // In pixels
        this.creating = false;
        this.size = {x: 0, y: 0};
        this.style = createStyle(styleAttributes, this.editor);
        this.style = copyStyle(editor.getDefaultStyle(), this.style);

        this.CREATION_METHOD_DRAG = 'CREATION_METHOD_DRAG';
        this.CREATION_METHOD_CLICK = 'CREATION_METHOD_CLICK';
        this.CREATION_METHOD_CLICKS = 'CREATION_METHOD_CLICKS';
        this.creationMethod = this.CREATION_METHOD_DRAG;

        addTraitEventDispatcher(this);
    }

    av.GlobalManagerMixin.call(EditMode.prototype);
    var proto = EditMode.prototype;

    proto.destroy = function() {

        this.unselect();
        removeTraitEventDispatcher(this);
    };

    proto.unselect = function() {

        var fireEv = false;
        var selectedMarkup = this.selectedMarkup;
        var selectedId = null;

        if (selectedMarkup) {
            selectedId = selectedMarkup.id;
            selectedMarkup.unselect();
            this.selectedMarkup = null;
            fireEv = true;
        }

        this.editor.editFrame.setMarkup(null);

        if (fireEv) {
            this.dispatchEvent({ type: MarkupEvents.EVENT_MARKUP_DESELECT, markupId: selectedId });
        }
    };

    proto.creationBegin = function() {

        if (this.creating) {
            return;
        }

        this.creating = true;
        this.dispatchEvent({ type: MarkupEvents.EVENT_EDITMODE_CREATION_BEGIN });
    };

    proto.creationEnd = function(isCancelling) {

        if (!this.creating) {
            return;
        }

        if (this.creationMethod !== this.CREATION_METHOD_CLICK) {

            if (this.selectedMarkup && !this.isMinSizeValid()) {

                this.creationCancel();
                isCancelling = true;
            } else {

                if (this.creationMethod === this.CREATION_METHOD_DRAG) {
                    this.finishDragging();
                }

                if (this.selectedMarkup) {

                    // Opened on mouse down.
                    this.editor.closeActionGroup();
                    this.selectedMarkup = null;
                }
            }
        }

        this.creating = false;
        this.dispatchEvent({ type: MarkupEvents.EVENT_EDITMODE_CREATION_END, creationCancelled: !!isCancelling });
    };

    proto.creationCancel = function() {

        this.editor.cancelActionGroup();
        this.creationEnd(true);
        this.selectedMarkup = null; // No need to call unselect
    };

    /**
     *
     * @param style
     */
    proto.setStyle = function(style) {

        this.style = style;

        var selectedMarkup = this.selectedMarkup;
        if(!selectedMarkup) {
            return;
        }

        var setStyle = new SetStyle(this.editor, selectedMarkup, style);
        setStyle.execute();
    };

    proto.getStyle = function() {

        return this.style;
    };

    proto.setSelection = function(markup) {

        if (this.selectedMarkup !== markup) {
            this.unselect();
            markup && markup.select();
        }

        this.selectedMarkup = markup;

        var editor = this.editor;
        markup && editor.bringToFront(markup);

        if (this.isTextInputHelperActive() && editor.editFrame.markup) {
            this.textInputHelper.setEditFrame();
        } else if (!this.creating) {
            editor.editFrame.setMarkup(markup);
        }
    };

    proto.getSelection = function() {

        return this.selectedMarkup;
    };

    /**
     *
     * @param [markup] If provided deletes markup (has to have same type that the edit mode), otherwise deletes selected one.
     * @param [cantUndo] If true to not add deletion to undo history.
     * @returns {boolean}
     */
    proto.deleteMarkup = function (markup, cantUndo) {

        return false;
    };

    /**
     * Used by classes extending EditMode to validate the minimum size (in screen coordinates) of the markup.
     * See minSize attribute
     * @return {Boolean} Whether current size is valid for creating the markup
     * @private
     */
    proto.isMinSizeValid = function() {

        if (this.minSize !== 0) {

            var tmp = this.editor.sizeFromMarkupsToClient(this.size.x, this.size.y);
            return (tmp.x*tmp.x + tmp.y*tmp.y) >= (this.minSize * this.minSize);

        }
        return true;
    };

    /**
     * @private
     */
    proto.startDragging = function() {

        var selectedMarkup = this.selectedMarkup;
        var mousePosition = this.editor.getMousePosition();

        if (selectedMarkup) {

            this.dragging = true;
            this.draggingAnnotationIniPosition = selectedMarkup.getClientPosition();
            this.draggingMouseIniPosition.set(mousePosition.x, mousePosition.y);
        }
    };

    /**
     * @private
     */
    proto.finishDragging = function() {

        var dragging = this.dragging;
        var selectedMarkup = this.selectedMarkup;

        this.dragging = false;

        if (selectedMarkup && dragging) {

            selectedMarkup.finishDragging();
        }
    };

    /**
     *
     * @returns {{x: number, y: number}}
     */
    proto.getFinalMouseDraggingPosition = function() {

        var editor = this.editor;
        var bounds = editor.getBounds();
        var mousePosition = editor.getMousePosition();

        var initialX = this.initialX;
        var initialY = this.initialY;

        var finalX = Math.min(Math.max(bounds.x, mousePosition.x), bounds.x + bounds.width);
        var finalY = Math.min(Math.max(bounds.y, mousePosition.y), bounds.y + bounds.height);

        if (finalX == initialX &&
            finalY == initialY) {
            finalX++;
            finalY++;
        }

        // Make equal x/y when shift is down
        if (editor.input.makeSameXY) {
            var dx = Math.abs(finalX - initialX);
            var dy = Math.abs(finalY - initialY);

            var maxDelta = Math.max(dx, dy);

            // These calculations have the opportunity to go beyond 'bounds'.
            finalX = initialX + maxDelta * sign(finalX - initialX);
            finalY = initialY + maxDelta * sign(finalY - initialY);
        }

        return { x:finalX, y:finalY };
    };

    proto.notifyAllowNavigation = function(allows) {

    };

    proto.onMouseMove = function (event) {

    };

    proto.onMouseDown = function () {

    };

    /**
     * Handler to mouse up events, used to start annotations creation.
     * It will cancel the creation of a markup if its minSize conditions are not met.
     *
     * @param {MouseEvent} event Mouse event.
     * @private
     */
    proto.onMouseUp = function(event) {

        if (this.creationMethod !== this.CREATION_METHOD_DRAG) {
            return;
        }

        this.creationEnd();
    };

    proto.onMouseDoubleClick = function(event) {

        if (this.creationMethod !== this.CREATION_METHOD_CLICKS) {
            return;
        }

        this.creationEnd();
    };

    /**
     * Notify the markup that the displayed markups are being saved so edit mode can finish current editions.
     */
    proto.onSave = function() {

        if (this.creating) {
            this.creationCancel();
        }
    };

    /**
     *
     * @returns {{x: *, y: *}}
     */
    proto.getDraggingPosition = function () {

        var mousePosition = this.editor.getMousePosition();

        var dx = mousePosition.x - this.draggingMouseIniPosition.x;
        var dy = mousePosition.y - this.draggingMouseIniPosition.y;

        return {
            x: this.draggingAnnotationIniPosition.x + dx,
            y: this.draggingAnnotationIniPosition.y + dy
        };
    };

    /**
     *
     * @param x
     * @param y
     * @param bounds
     * @returns {boolean}
     * @orivate
     */
    proto.isInsideBounds = function (x, y, bounds) {

        return x >= bounds.x && x <= bounds.x + bounds.width &&
               y >= bounds.y && y <= bounds.y + bounds.height;
    };

    /*
     * Decides whether to use the snapper in the current edit mode or not.
     * 
     * @returns {boolean}
     */
    proto.useWithSnapping = function () {
        return this.viewer.model.is2d();
    };

    
    proto.isTextInputHelperActive = function() {
        return this.textInputHelper && this.textInputHelper.isActive();
    };
