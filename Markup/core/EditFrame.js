'use strict';

import { EDIT_FRAME_DEFAULT_MARGIN, 
         addTraitEventDispatcher, isTouchDevice, degreesToRadians } from './MarkupsCoreUtils'
import * as MarkupEvents from './MarkupEvents'
import { CloneMarkup } from './edit-actions/CloneMarkup'
import { SetPosition } from './edit-actions/SetPosition'
import { SetSize } from './edit-actions/SetSize'
import { SetRotation } from './edit-actions/SetRotation'

     var av = Autodesk.Viewing;
     var avp = Autodesk.Viewing.Private;

    /**
     * A component to handle the selection of markups.
     *
     *
     *      Sample
     *
     *      var containingDiv = document.getElementById('containingDiv3d-app-wrapper');
     *      var selectionComponent = new EditFrame(containingDiv);
     *      selectionComponent.setSelection(100, 100, 300, 150, 0);
     *
     * @param {HTMLElement} containingDiv The container where the selection layer will live.
     * @param {Object} editor
     * @constructor
     */
    export function EditFrame(containingDiv, editor) {

        this.containingDiv = containingDiv;
        this.editor = editor;
        this.setGlobalManager(this.editor.viewer.globalManager);
        this.selectionLayer = createSelectionLayer.bind(this)();

        this.frameMargin = EDIT_FRAME_DEFAULT_MARGIN;

        this.selection = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            rotation: 0,
            element: null,
            active: false,
            dragging: false,
            resizing: false,
            //a dictionary of all the drag points
            //the key for each drag point will be its cardinal/ordinal direction
            handle: {}
        };

        createSelectorBox.bind(this)();

        if (isTouchDevice()) {
            this.hammer = new av.Hammer.Manager(this.selectionLayer, {
                recognizers: [
                    av.GestureRecognizers.drag,
                    av.GestureRecognizers.doubletap,
                    av.GestureRecognizers.doubletap2,
                    av.GestureRecognizers.pan,
                    av.GestureRecognizers.pinch
                ],
                handlePointerEventMouse: false,
                inputClass: av.isIE11 ? av.Hammer.PointerEventInput : av.Hammer.TouchInput
            });

            this.onHammerDragBinded = this.onHammerDrag.bind(this);
            this.onHammerDoubleTapBinded = this.onHammerDoubleTap.bind(this);
            this.onTouchPanBinded = this.onTouchPan.bind(this);
            this.onTouchPinchBinded = this.onTouchPinch.bind(this);

            this.hammer.on("dragstart dragmove dragend", this.onHammerDragBinded);
            this.hammer.on("doubletap", this.onHammerDoubleTapBinded);
            this.hammer.on("doubletap2", this.onHammerDoubleTapBinded);
            this.hammer.on("panstart panmove panend", this.onTouchPanBinded);
            this.hammer.on("pinchstart pinchmove pinchend", this.onTouchPinchBinded);

            this.hammer.get('drag').requireFailure('pinch');
            this.hammer.get('drag').requireFailure('pan');
        }

        handleSelectionBoxDragging.bind(this)();
        handleSelectionBoxResizing.bind(this)();
        handleSelectionDoubleClick.bind(this)();
        handleSelectionBoxRotating.bind(this)();

        //add the selection into the container given to us
        this.containingDiv.appendChild(this.selectionLayer);

        addTraitEventDispatcher(this);
    }

    av.GlobalManagerMixin.call(EditFrame.prototype);
    var proto = EditFrame.prototype;

    proto.unload = function() {

        this.containingDiv.removeChild(this.selectionLayer);
        this.selectionLayer = null;
    };
    /**
     * Draws a selection box with the given attributes
     *
     * @param {number} x - The x coordinate to place the selection box
     * @param {number} y - The y coordinate to place the selection box
     * @param {number} width - The width of the selection box
     * @param {number} height - The height of the selection box
     * @param {number} rotation - The amount of degrees to rotate the selection box
     */
    proto.setSelection = function (x, y, width, height, rotation) {

        var margin = this.frameMargin;
        var doubleMargin = margin * 2;

        updateSelectorBoxDimensions.bind(this)(width + doubleMargin, height + doubleMargin);
        updateSelectorBoxPosition.bind(this)(x - margin, y - margin, rotation);
        updateSelectionBoxState.bind(this)(true); //activate the selection box
        this.selectionLayer.style.visibility = 'visible';
    };

    /**
     * Displays the selection box based on the position, dimension, and rotation of a given markup
     *
     * @param {Autodesk.Viewing.Extensions.Markups.Core.Markup} markup - the markup that should appear as selected
     */
    proto.setMarkup = function (markup) {

        this.hammer && this.hammer.set({enable: markup !== null});
        this.markup = markup;

        updateSelectionBoxState.bind(this)(false);

        if (markup) {
            var boundingBox = markup.getBoundingRect();
            var rotation = markup.getRotation();
            this.frameMargin = boundingBox.margin !== undefined ? boundingBox.margin : EDIT_FRAME_DEFAULT_MARGIN;

            this.setSelection(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height, rotation);

            this.enableResizeHandles();
            this.enableRotationHandle();

            if (markup.preventReposition) {
                this.selectionLayer.firstChild.style.cursor = '';
            }
            else {
                this.selectionLayer.firstChild.style.cursor = 'move';
            }
        }
    };

    proto.startDrag = function (event) {

        if (this.markup && this.markup.preventReposition) return;

        this.onMouseMove = this._onRepositionMouseMove.bind(this);
        this.onMouseUp = this._onRepositionMouseUp.bind(this);
        this._onRepositionMouseDown(event, this.editor.getMousePosition());
    };

     proto.isActive = function() {
        return this.selection.active;
     };

    proto.isDragging = function () {

        return this.selection.dragging;
    };

    proto.isResizing = function () {

        return this.selection.resizing;
    };

    proto.isRotating = function () {

        return this.selection.rotating;
    };

    proto.onMouseMove = function (event) {

        //dummy fn
    };

    proto.onMouseUp = function (event) {
        //dummy fn
    };

    proto.onWheel = function (event) {
        this.editor.viewer.toolController.mousewheel(event);
    };

    proto.onTouchPan = function(event) {
        var gestureHandler = this.editor.viewer.toolController.getTool("gestures");
        gestureHandler.distributeGesture(event);
        event.preventDefault();
    };

    proto.onTouchPinch = function(event) {
        var gestureHandler = this.editor.viewer.toolController.getTool("gestures");
        gestureHandler.distributeGesture(event);
        event.preventDefault();
    };

     proto.onHammerDrag = function(event) {

         function updateEditorInput(input, parent, event) {

             //TODO: Change this when refactoring input in edit frame.
             var rect = parent.getBoundingClientRect();
             input.mousePosition.x = event.pageX - rect.left;
             input.mousePosition.y = event.pageY - rect.top;
         }

        //console.log('EditFrame drag ' + event.type);
         convertEventHammerToMouse(event);
         switch (event.type) {
             case 'dragstart':
                 updateEditorInput(this.editor.input, this.editor.svg, event);
                 this.editor.callSnapperMouseDown();
                 // Check whether to translate, rotate or resize
                 if (isRotatePoint(event.target)) {
                     // Rotate
                     this._onRotationMouseDown(event);
                 } else if (isDragPoint(event.target)) {
                     // Resize
                     this._onResizeMouseDown(event);
                 } else {
                     this.startDrag(event);
                 }
                 event.preventDefault();
                 break;
             case 'dragmove':
                 updateEditorInput(this.editor.input, this.editor.svg, event);
                 this.editor.callSnapperMouseMove();
                 this.onMouseMove(event);
                 event.preventDefault();
                 break;
             case 'dragend':
                 updateEditorInput(this.editor.input, this.editor.svg, event);
                 this.onMouseUp(event);
                 event.preventDefault();
                 break;
         }
     };

    proto.onHammerDoubleTap = function(event) {

        function updateEditorInput(input, parent, event) {

            //TODO: Change this when refactoring input in edit frame.
            var rect = parent.getBoundingClientRect();
            input.mousePosition.x = event.pageX - rect.left;
            input.mousePosition.y = event.pageY - rect.top;
        }

        convertEventHammerToMouse(event);
        updateEditorInput(this.editor.input, this.editor.svg, event);

        this.selection.dragging = false;
        this.editor.editMode && this.editor.editMode.onMouseDoubleClick(this.markup);
    };

    proto.enableResizeHandles = function () {

        var markup = this.markup;
        var handle;

        if (markup.isHeightConstrained() || markup.isWidthConstrained()) {
            //hide all the handles
            for (var direction in this.selection.handle) {
                handle = this.selection.handle[direction];
                if(handle) handle.style.display = 'none';
            }

            //show only the resize points that are allowed
            if (!markup.isHeightConstrained()) {
                this.selection.handle['n'].style.display = 'block';
                this.selection.handle['s'].style.display = 'block';
            }
            if (!markup.isWidthConstrained()) {
                this.selection.handle['w'].style.display = 'block';
                this.selection.handle['e'].style.display = 'block';
            }
        } else {
            //no constraints, show all resize handles
            for (var direction in this.selection.handle) {
                handle = this.selection.handle[direction];
                if(handle) handle.style.display = 'block';
            }
        }
    };

    proto.enableRotationHandle = function () {

        var markup = this.markup;
        var display = markup.isRotationConstrained() ? 'none' : 'block';
        this.selection.rotationHandle.style.display = display;
        this.selection.rotationBridge.style.display = display;
    };

     function convertEventHammerToMouse(event) {
         // Convert Hammer touch-event X,Y into mouse-event X,Y.
         event.pageX = event.pointers[0].clientX;
         event.pageY = event.pointers[0].clientY;
     }

    /**
     * Creates an element spanning the full height and width of its parent.
     * It serves as our surface to draw the selection box.
     *
     * @return {HTMLElement}
     */
    function createSelectionLayer() {

        const _document = this.getDocument();
        var selectionLayer = _document.createElement('div');
        selectionLayer.style.position = 'absolute';
        selectionLayer.style.top = 0;
        selectionLayer.style.bottom = 0;
        selectionLayer.style.left = 0;
        selectionLayer.style.right = 0;
        //don't let the selection box be visible outside the selection layer
        selectionLayer.style.overflow = 'hidden';
        selectionLayer.style.visibility = 'hidden';
        togglePointerEvents(selectionLayer, false);
        return selectionLayer;
    }

    /**
     * Creates a single drag point with the corresponding styles
     *
     * @param {number} diameter - The size of the drag point
     * @param {string} position - The cardinal(n, s, w, e) or ordinal(nw, nw, sw, se) direction of the point
     * @return {HTMLElement}
     */
    function createDragPoint(position) {

        const _document = this.getDocument();
        var point = _document.createElement('div');

        setResizeCursor(point, position);
        point.className = 'selector-drag-point autodesk-markups-extension-core-make-me-bigger sdp-handle-' + position;
        point.classList.add('adsk-viewing-viewer');
        point.setAttribute('data-sdp-handle', position);

        return point;
    }

    function createRotatePoint () {
        const _document = this.getDocument();
        var point = _document.createElement('div');
        point.classList.add('adsk-viewing-viewer');
        point.classList.add('selector-rotate-point');
        point.classList.add('autodesk-markups-extension-core-make-me-bigger');
        setResizeCursor(point, 'w');

        return point;
    }

    function createRotationBridge() {
        const _document = this.getDocument();
        var rotationBridge = _document.createElement('div');
        rotationBridge.classList.add('adsk-viewing-viewer');
        rotationBridge.classList.add('selector-rotate-point');
        rotationBridge.classList.add('autodesk-markups-extension-core-make-me-bigger');
        rotationBridge.classList.add('rotation-bridge');
        setResizeCursor(rotationBridge, 'w');

        return rotationBridge;
    }

    function setResizeCursor (element, direction) {

        var cursor;
        switch(direction) {
            case 'n':
            case 's':
                cursor = 'ns-resize';
                break;
            case 'w':
            case 'e':
                cursor = 'ew-resize';
                break;
            case 'ne':
            case 'sw':
                cursor = 'nesw-resize';
                break;
            case 'nw':
            case 'se':
                cursor = 'nwse-resize';
                break;
        }
        element.style.cursor = cursor;
    }

    /**
     * Creates the 8 drag points of the selection box.
     *
     * @this EditFrame
     */
    function createDragPoints(selector) {

        ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'].forEach(function (direction) {
            //store the drag point and put it in the DOM
            this.selection.handle[direction] = createDragPoint.call(this, direction);
            selector.appendChild(this.selection.handle[direction]);
        }.bind(this));
    }

    /**
     * Determines if an element is a drag point
     *
     * @return {boolean}
     */
    function isDragPoint(element) {

        return matchesSelectorAux(element, '.selector-drag-point');
    }

    /**
     * Determines if an element is a rotate point
     *
     * @return {boolean}
     */
    function isRotatePoint(element) {

        return matchesSelectorAux(element, '.selector-rotate-point');
    }

    /**
     * Creates the element that will be used as the selection box. It also
     * takes care of adding the drag handles
     *
     * @return {HTMLElement} - the selection box
     * @this EditFrame
     */
    function createSelectorBox() {

        const _document = this.getDocument();
        var selectorBox = _document.createElement('div');
        togglePointerEvents(selectorBox, true);
        selectorBox.classList.add('selector-box');

        this.selection.rotationBridge = createRotationBridge.bind(this)();
        selectorBox.appendChild(this.selection.rotationBridge);

        this.selection.rotationHandle = createRotatePoint.bind(this)();
        selectorBox.appendChild(this.selection.rotationHandle);

        createDragPoints.bind(this)(selectorBox);

        //store the selector box
        this.selection.element = selectorBox;

        if (!av.isMobileDevice()) {
            this.onWheelBinded = this.onWheel.bind(this);
            this.selection.element.addEventListener('wheel', this.onWheelBinded);
            this.selection.element.addEventListener('DOMMouseScroll', this.onWheelBinded); // firefox
        }

        //add the selection box to the selection layer
        this.selectionLayer.appendChild(this.selection.element);

        //we are just creating the box, start it out hidden
        updateSelectionBoxState.bind(this)(false);

        return selectorBox;
    }

    /**
     * Utility to create the CSS translate3d value from a given 2d point
     *
     * @param {number} x - coordinate
     * @param {number} y - coordinate
     * @return {string}
     */
    function toTranslate3d(x, y) {

        return 'translate3d(' + x + 'px,' + y + 'px,0)';
    }


    /**
     * Updates the display state of the selection box
     *
     * @param {boolean} active - The new state of the the selection box
     * @this EditFrame
     */
    function updateSelectionBoxState(active) {

        this.selection.active = active;
        this.selection.element.style.display = active ? 'block' : 'none';
    }

    /**
     * Updates the position and rotation of the selection box.
     *
     * @param {number} x - The x coordinate to place the selection box
     * @param {number} y - The y coordinate to place the selection box
     * @param {number} rotation - The amount of degrees to rotate the selection box
     * @this EditFrame
     */
    function updateSelectorBoxPosition(x, y, rotation) {

        this.selection.x = x;
        this.selection.y = y;
        this.selection.rotation = rotation;
        var size = this.markup.getBoundingRect();
        //TODO: consider DomElementStyle

        size.width += this.frameMargin * 2;
        size.height += this.frameMargin * 2;

        var transform = toTranslate3d(x, y) + ' rotate(' + rotation + 'rad)';
        var transformOrigin = (size.width / 2) + 'px ' + (size.height / 2) + 'px';

        this.selection.element.style.msTransform =
            this.selection.element.style.webkitTransform =
            this.selection.element.style.transform = transform;
        this.selection.element.style.msTransformOrigin =
            this.selection.element.style.webkitTransformOrigin =
            this.selection.element.style.transformOrigin = transformOrigin;
    }

    /**
     * Updates the dimensions of the selection box (width and height).
     *
     * @param {number} width - The new width of the selection box
     * @param {number} height - The new height of the selection box
     * @this EditFrame
     */
    function updateSelectorBoxDimensions(width, height) {

        this.selection.width = width;
        this.selection.height = height;
        this.selection.element.style.width = width + 'px';
        this.selection.element.style.height = height + 'px';
    }

    /**
     * Attaches all the necessary listeners to handle a drag action.
     *
     * @this EditFrame
     */
    function handleSelectionBoxDragging () {

        this.selection.element.addEventListener('mousedown', this._onRepositionMouseDown.bind(this));
    }

    /**
     * Handles panning when right clicking down
     * @param event
     * @returns {boolean} returns true if the event was handled
     * @private
     */
    proto._handleRightClickDown = function(event) {

        if (!av.isMobileDevice() && (avp.isRightClick(event, this.editor.viewer.navigation) || avp.isMiddleClick(event))) {
            this.editor.input.onMouseDownRightClick(event);
            return true;
        }

        return false;
    };

    var ignoreFirstMouseMove = false;
    proto._onRepositionMouseDown = function (event, cursor) {

        if (this._handleRightClickDown(event))
            return;

        // Return for markups that are not allowed to be repositioned.
        if (this.markup && this.markup.preventReposition) return;

        // ignore the first mouse move for the Microsoft Surface
        ignoreFirstMouseMove = !av.isMobileDevice() && av.isTouchDevice();
        //a synthetic start means that the event was triggered manually and not as a
        //result of a mousedown on the edit frame
        const _window = this.getWindow();
        var syntheticStart = !(event instanceof _window.MouseEvent);

        //during a real mousedown, ignore events originating from a resizing handle
        if (!syntheticStart && (isDragPoint(event.target) || isRotatePoint(event.target))) return;

        //get the cursor position
        cursor = syntheticStart ?  cursor : this.editor.getMousePosition();

        //store the initial cursor and axis constrains
        this.initialCursor = cursor;
        this.initialPosition = this.markup.getClientPosition();
        this.areAxisConstrained = false;
        this.axisConstrains = new THREE.Vector2(1,1);

        //update the function that will handle the mousemove and mouseup events
        this.onMouseMove = this._onRepositionMouseMove.bind(this);
        this.onMouseUp = this._onRepositionMouseUp.bind(this);

        if (this.selection.dragging)
            return;

        this.selection.dragging = true;
        this.editor.beginActionGroup();

        //if alt down I drop a clone.
        if (event && event.altKey) {
            var editor = this.editor;
            var cloneMarkup = new CloneMarkup(editor, editor.getId(), this.markup, this.markup.position);
            cloneMarkup.execute();
        }

        this.dispatchEvent({ type: MarkupEvents.EVENT_EDITFRAME_EDITION_START }); // Moving around
    };

    proto._onRepositionMouseMove = function(event) {

        // This check is needed for selecting markups on devices that have touch screen + mouse (eg: Microsoft Surface)
        if (ignoreFirstMouseMove) {
            ignoreFirstMouseMove = false;
            return;
        }
        //ignore mousemove events if the dragging state hasn't been activated
        if (!this.selection.dragging || !this.markup || this.markup.preventReposition) return;

        //get the position of the cursor relative to selection layer
        var cursor = this.editor.getMousePosition();

        //constrain axis if shift key is down.
        var constrainAxis = this.editor.input.constrainAxis;
        if (this.areAxisConstrained !== constrainAxis) {
            this.areAxisConstrained = constrainAxis;
            this.axisConstrains = constrainAxis ? new THREE.Vector2(0, 0) : new THREE.Vector2(1,1);

            this.initialPosition.x += cursor.x - this.initialCursor.x;
            this.initialPosition.y += cursor.y - this.initialCursor.y;

            this.initialCursor.x = cursor.x;
            this.initialCursor.y = cursor.y;
        }

        //determine how many pixel we have to shift the
        //selection box to keep the cursor on the drag point
        var movement = {
            x: cursor.x - this.initialCursor.x,
            y: cursor.y - this.initialCursor.y
        };

        var deadZone = 15;
        if (this.axisConstrains.x === 0 && this.axisConstrains.y === 0) {

            if (Math.abs(movement.x) > deadZone) {
                this.axisConstrains.x = 1;
                movement.x += movement.x < 0 ?  deadZone : -deadZone;
            } else
            if (Math.abs(movement.y) > deadZone) {
                this.axisConstrains.y = 1;
                movement.y += movement.y < 0 ?  deadZone : -deadZone;
            }
        }

        var x = this.initialPosition.x + movement.x * this.axisConstrains.x;
        var y = this.initialPosition.y + movement.y * this.axisConstrains.y;

        updateSelectorBoxPosition.bind(this)(x, y, this.selection.rotation);

        //tell the markup to start transforming
        //the markup expects an (x, y) coordinate that
        //uses an origin at the center, adjust our x, y because
        //our origin starts at the top left
        var position = this.editor.positionFromClientToMarkups(x, y);
        var setPosition = new SetPosition(this.editor, this.markup, position);
        setPosition.execute();
    };

    proto._onRepositionMouseUp = function () {

        if (this.markup && this.markup.preventReposition) return;

        this.last = null;

        //this should never be called after the mouse up because we are no longer repositioning
        this.onMouseMove = function () {/*do nothing*/};
        this.onMouseUp = function () {/*do nothing*/};

        if(!this.selection.dragging) {
            return;
        }

        this.editor.closeActionGroup();
        this.selection.dragging = false;
        this.dispatchEvent({ type: MarkupEvents.EVENT_EDITFRAME_EDITION_END }); // Moving around
    };

    proto._onResizeMouseDown = function (event) {

        if (this._handleRightClickDown(event))
            return;

        var target = event.target;

        //is the target where the mousedown occurred a drag point
        if (!isDragPoint(target)) {
            return;
        }

        //keep a reference to the point where the drag started
        this.selection.handle.resizing = target;
        //figure out which direction this point should resize
        var direction = this.selection.handle.resizing.getAttribute('data-sdp-handle');
        //set the cursor position for the entire layer
        this.containingDiv.style.cursor = direction + '-resize';

        var cursor = this.editor.getMousePosition();

        var position = this.markup.getClientPosition();
        var size = this.markup.getBoundingRect();

        //store the center
        this.initial = {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
            mouseX: cursor.x,
            mouseY: cursor.y
        };

        this.onMouseMove = this._onResizeMouseMove.bind(this);
        this.onMouseUp = this._onResizeMouseUp.bind(this);

        if (this.selection.resizing) {
            return;
        }

        this.selection.resizing = true;
        this.editor.beginActionGroup();

        setHandleSelected(event.target, true);

        //notify the markup that dragging has started
        this.dispatchEvent({ type: MarkupEvents.EVENT_EDITFRAME_EDITION_START }); // Resizing
    };

    proto._onResizeMouseMove = function (event) {

        if (!this.selection.resizing) return;

        var cursor = this.editor.getMousePosition();
        var initial = this.initial;

        var movement = {
            x: cursor.x - initial.mouseX,
            y: cursor.y - initial.mouseY
        };

        var vector = new THREE.Vector3(movement.x, movement.y, 0);
        var undoRotation = new THREE.Matrix4().makeRotationZ(-this.selection.rotation);
        movement = vector.applyMatrix4(undoRotation);

        var x = initial.x,
            y = initial.y,
            width = initial.width,
            height = initial.height;

        var localSpaceDelta = new THREE.Vector3();

        //get the direction of the arrow being dragged
        var direction = this.selection.handle.resizing.getAttribute('data-sdp-handle');

        // TODO: Make a mechanism to configure and use this feature from Markups Core.
        // If shift is pressed, figure aspect ratio is maintained.
        if (this.editor.input.keepAspectRatio && ['nw', 'ne', 'sw', 'se'].indexOf(direction) !== -1) {

            var delta = new THREE.Vector3(movement.x, movement.y, 0);
            switch (direction){
                case 'nw': movement.set(-initial.width,-initial.height, 0); break;
                case 'ne': movement.set( initial.width,-initial.height, 0); break;
                case 'sw': movement.set( initial.width,-initial.height, 0); break;
                case 'se': movement.set( initial.width, initial.height, 0); break;
            }
            movement.normalize();
            movement = delta.projectOnVector(movement);
        }

        var translations = {
            n: function () {
                height -= movement.y;
                localSpaceDelta.y = movement.y;
            },
            s: function () {
                height += movement.y;
                localSpaceDelta.y = movement.y;
            },
            w: function () {
                width -= movement.x;
                localSpaceDelta.x = movement.x;
            },
            e: function () {
                width += movement.x;
                localSpaceDelta.x = movement.x;
            },
            nw: function () {
                this.n();
                this.w();
            },
            ne: function () {
                this.n();
                this.e();
            },
            sw: function () {
                this.s();
                this.w();
            },
            se: function () {
                this.s();
                this.e();
            }
        };

        translations[direction]();

        // Check if new size is smaller than min width or height
        if (width <= this.markup.getMinWidth() || height <= this.markup.getMinHeight()) return;

        var redoRotation = new THREE.Matrix4().makeRotationZ(this.selection.rotation);
        var actualDelta = localSpaceDelta.applyMatrix4(redoRotation);

        var newPos = this.editor.positionFromClientToMarkups(
            x + (actualDelta.x * 0.5),
            y + (actualDelta.y * 0.5));

        var newSize = this.editor.sizeFromClientToMarkups(width, height);

        var setSize = new SetSize(this.editor, this.markup, newPos, newSize.x, newSize.y);
        setSize.execute();
    };

    function setHandleSelected (handle, isSelected) {
        if (isSelected) {
            handle.classList.add('selected');
        } else {
            handle.classList.remove('selected');
        }
    }

    proto._onResizeMouseUp = function (event) {
        this.selection.resizing = false;
        this.selection.handle.resizing = null;
        this.containingDiv.style.cursor = '';

        for (var direction in this.selection.handle) {
            if (this.selection.handle[direction]) {
                setHandleSelected(this.selection.handle[direction], false);
            }
        }


        this.editor.closeActionGroup();
        this.dispatchEvent({ type: MarkupEvents.EVENT_EDITFRAME_EDITION_END }); // Resizing

        //this should never be called after the mouse up because we are no longer resizing
        this.onMouseMove = function () {/*do nothing*/
        };
        this.onMouseUp = function () {/*do nothing*/
        };
    };


    /**
     * Attaches all the necessary listeners to handle a resizing action.
     *
     * @this EditFrame
     */
    function handleSelectionBoxResizing() {
        this.selectionLayer.addEventListener('mousedown', this._onResizeMouseDown.bind(this));
    }

    function handleSelectionBoxRotating () {

        this.selection.element.addEventListener('mousedown', this._onRotationMouseDown.bind(this));
    }

    var initialRotation;
    var initialHandlePosition;

    proto._onRotationMouseDown = function (event) {

        if (this._handleRightClickDown(event))
            return;

        //ignore anything not coming from the rotation point
        if (!isRotatePoint(event.target)) return;

        this.editor.beginActionGroup();
        this.selection.rotating = true;

        //store the initial cursor
        initialHandlePosition = this.editor.getMousePosition();

        initialRotation = this.selection.rotation || 0;

        //update the function that will handle the mousemove and mouseup events
        this.onMouseMove = this._onRotationMouseMove.bind(this);
        this.onMouseUp = this._onRotationMouseUp.bind(this);

        setHandleSelected(event.target, true);

        this.dispatchEvent({ type: MarkupEvents.EVENT_EDITFRAME_EDITION_START }); // Rotating
    };

     proto._onRotationMouseMove = function (event) {

        //ignore mousemove events if the dragging state hasn't been activated
        if (!this.selection.rotating) return;

        var cursor = this.editor.getMousePosition();
        var position = this.markup.getClientPosition();

        var r = getAngleBetweenPoints(position, cursor);
        var r2 = getAngleBetweenPoints(position, initialHandlePosition);
        var rotation = r - r2 + initialRotation;

        // TODO: Make a mechanism to configure and use this feature from Markups Core.
        if (this.editor.input.snapRotations) {
            var snap = degreesToRadians(22.5);
            rotation = Math.ceil(rotation / snap) * snap;
        }

         //pass rotation as degrees
         updateSelectorBoxPosition.bind(this)(this.selection.x, this.selection.y, rotation);

        //convert to radians
        var setRotation = new SetRotation(this.editor, this.markup, rotation);
        setRotation.execute();
    };

    proto._onRotationMouseUp = function (event) {

        this.selection.rotating = false;
        initialRotation = null;
        initialHandlePosition = null;
        setHandleSelected(this.selection.rotationHandle, false);
        this.editor.closeActionGroup();
        this.dispatchEvent({ type: MarkupEvents.EVENT_EDITFRAME_EDITION_END }); // Rotating
    };

    /**
     * Attaches double click listener and pass events to markup, markups such as text use it to enter text edit
     * mode.
     *
     * @this EditFrame
     */
    function handleSelectionDoubleClick() {

        var doubleClick = function (event) {
            if (event.defaultPrevented) {
                return;
            }
            this.selection.dragging = false;
            var editMode = this.editor.editMode;
            editMode && editMode.onMouseDoubleClick(this.markup);
        }.bind(this);

        var selectorBoxWrapper = this.selectionLayer;
        selectorBoxWrapper.addEventListener('dblclick', doubleClick);
    }

    function togglePointerEvents(element, state) {

        element.style.pointerEvents = state ? 'auto' : 'none';
    }

    function getAngleBetweenPoints (p1, p2) {

        return Math.atan2(p2.y - p1.y, p2.x - p1.x);
    }

     function matchesSelectorAux(domElem, selector) {
         if (domElem.matches) return domElem.matches(selector); //Un-prefixed
         if (domElem.msMatchesSelector) return domElem.msMatchesSelector(selector);  //IE
         if (domElem.mozMatchesSelector) return domElem.mozMatchesSelector(selector); //Firefox (Gecko)
         if (domElem.webkitMatchesSelector) return domElem.webkitMatchesSelector(selector); // Opera, Safari, Chrome
         return false;
     }
