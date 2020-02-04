'use strict';

import { isTouchDevice } from '../MarkupsCoreUtils'

    var av = Autodesk.Viewing;
    var avp = av.Private;

    var _mouseEnabled = false;
    var _mousePrevValue = false;
    var _lock = false;

    export function InputHandler() {

        this.editor = null;
        this.mousePosition = {x:0, y:0};
        this.makeSameXY = false; // TODO: FIND a better way to name and communicate these.
        this.snapRotations = false;
        this.keepAspectRatio = false;
        this.constrainAxis = false;
        this.duringEditMode = false;

        this.onWheelBinded = this.onWheel.bind(this);
        this.onTouchDragBinded = this.onTouchDrag.bind(this);
        this.onTouchPanBinded = this.onTouchPan.bind(this);
        this.onTouchPinchBinded = this.onTouchPinch.bind(this);
        this.onSingleTapBinded = this.onSingleTap.bind(this);
        this.onDoubleTapBinded = this.onDoubleTap.bind(this);
        this.onMouseMoveBinded = this.onMouseMove.bind(this);
        this.onMouseUpBinded = this.onMouseUp.bind(this);
        this.onMouseDownBinded = this.onMouseDown.bind(this);
        this.onMouseDoubleClickBinded = this.onMouseDoubleClick.bind(this);
        this.onHammerInputBinded = this.onHammerInput.bind(this);
        this.isMouseDown = false;
    }

    av.GlobalManagerMixin.call(InputHandler.prototype);
    var proto = InputHandler.prototype;

    proto.attachTo = function(editor) {

        this.editor && this.detachFrom(this.editor);
        this.editor = editor;

        if (isTouchDevice()) {

            this.hammer = new av.Hammer.Manager(editor.svg, {
                recognizers: [
                    av.GestureRecognizers.drag,
                    av.GestureRecognizers.doubletap,
                    av.GestureRecognizers.doubletap2,
                    av.GestureRecognizers.singletap,
                    av.GestureRecognizers.singletap2,
                    av.GestureRecognizers.press,
                    av.GestureRecognizers.pan,
                    av.GestureRecognizers.pinch
                ],
                handlePointerEventMouse: false,
                inputClass: av.isIE11 ? av.Hammer.PointerEventInput : av.Hammer.TouchInput
            });

            this.hammer.get('doubletap2').recognizeWith('doubletap');
            this.hammer.get('singletap2').recognizeWith('singletap');
            this.hammer.get('singletap').requireFailure('doubletap');
        }
    };

    proto.onHammerInput = function(event) {

        this.setMouseDisabledWhenTouching(event);
    };

    proto.setMouseDisabledWhenTouching = function(event) {

        if (event.isFirst && !_lock) {
            this.enableMouseButtons(false);
            _lock = true;
        } else if (event.isFinal) {
            var _this = this;
            setTimeout(function() {
                _this.enableMouseButtons(_mousePrevValue);
                _lock = false;
            }, 10);
        }
    };

    proto.enableMouseButtons = function(state) {

        if (state && !_mouseEnabled)
        {
            this.editor.svg.addEventListener('mousedown', this.onMouseDownBinded);
            this.editor.svg.addEventListener('dblclick', this.onMouseDoubleClickBinded);
            this.editor.svg.addEventListener('wheel', this.onWheelBinded);
            this.editor.svg.addEventListener('DOMMouseScroll', this.onWheelBinded); // Firefox
            this.addDocumentEventListener('mousemove', this.onMouseMoveBinded);
            this.addDocumentEventListener('mouseup', this.onMouseUpBinded);
        }
        else if (!state && _mouseEnabled)
        {
            this.editor.svg.removeEventListener('mousedown', this.onMouseDownBinded);
            this.editor.svg.removeEventListener('dblclick', this.onMouseDoubleClickBinded);
            this.editor.svg.removeEventListener('wheel', this.onWheelBinded);
            this.editor.svg.removeEventListener('DOMMouseScroll', this.onWheelBinded);
            this.removeDocumentEventListener('mousemove', this.onMouseMoveBinded);
            this.removeDocumentEventListener('mouseup', this.onMouseUpBinded);

        }

        _mousePrevValue = _mouseEnabled;
        _mouseEnabled = state;
    };

    proto.detachFrom = function(editor) {

        this.hammer && this.hammer.destroy();

        this.removeDocumentEventListener('mousemove', this.onMouseMoveBinded);
        this.removeDocumentEventListener('mouseup', this.onMouseUpBinded);

        if (this.editor) {
            this.editor.svg.removeEventListener('mousedown', this.onMouseDownBinded);
            this.editor.svg.removeEventListener('dblclick', this.onMouseDoubleClickBinded);
        }

        this.editor = editor;
    };

    proto.enterEditMode = function() {
        if (this.duringEditMode) {
            return;
        }

        if (this.hammer) {
            this.hammer.on('dragstart dragmove dragend', this.onTouchDragBinded);
            this.hammer.on('panstart panmove panend', this.onTouchPanBinded);
            this.hammer.on('pinchstart pinchmove pinchend', this.onTouchPinchBinded);
            this.hammer.on('singletap', this.onSingleTapBinded);
            this.hammer.on('singletap2', this.onSingleTapBinded);
            this.hammer.on('doubletap', this.onDoubleTapBinded);
            this.hammer.on('doubletap2', this.onDoubleTapBinded);
            this.hammer.on('hammer.input', this.onHammerInputBinded);

			this.hammer.get('drag').requireFailure('pinch');
            this.hammer.get('drag').requireFailure('pan');
        }

        if (!av.isMobileDevice()) {
            this.enableMouseButtons(true);
        }

        this.duringEditMode = true;
    };

    proto.leaveEditMode = function() {
        if (!this.duringEditMode) {
            return;
        }

        if (this.hammer) {
            this.hammer.off('dragstart dragmove dragend', this.onTouchDragBinded);
			this.hammer.off('panstart panmove panend', this.onTouchPanBinded);
            this.hammer.off('pinchstart pinchmove pinchend', this.onTouchPinchBinded);
            this.hammer.off('singletap', this.onSingleTapBinded);
            this.hammer.off('singletap2', this.onSingleTapBinded);
            this.hammer.off('doubletap', this.onDoubleTapBinded);
            this.hammer.off('doubletap2', this.onDoubleTapBinded);
            this.hammer.off('hammer.input', this.onHammerInputBinded);
        }

        if (!av.isMobileDevice()) {
            this.enableMouseButtons(false);
        }

        this.duringEditMode = false;
    };

    proto.enterViewMode = function() {

    };

    proto.leaveViewMode = function() {

    };

    proto.getMousePosition = function() {

        return {x: this.mousePosition.x, y: this.mousePosition.y};
    };

    proto.onWheel = function(event) {

        if (!av.isMobileDevice()) {
            this.editor.viewer.toolController.mousewheel(event);
        }

        event.preventDefault();
    };

    proto.onMouseMove = function(event) {

        processMouseEvent(this, event);

        if (!av.isMobileDevice()) {
            this.editor.viewer.toolController.mousemove(event);
        }

        this.editor.onMouseMove(event);
        event.preventDefault();
    };


    proto.onMouseDownRightClick = function(event) {

        const _document = this.getDocument();
        // Don't do blur in full screen (IE issue)
        if (!(av.isIE11 && av.inFullscreen(_document))) {
            _document.activeElement && _document.activeElement.blur && _document.activeElement.blur();
        }

        var controller = this.editor.viewer.toolController;
        controller.__clientToCanvasCoords(event);

        this.editor.markupTool.handleButtonDown(event, 2);
    };

    proto.onMouseUpRightClick = function(event) {

        var controller = this.editor.viewer.toolController;
        controller.__clientToCanvasCoords(event);

        this.editor.markupTool.handleButtonUp(event, 2);
    };

    proto.onMouseDown = function(event) {

        processMouseEvent(this, event);

        // Panning when right clicking
        if (!av.isMobileDevice() && (avp.isRightClick(event, this.editor.viewer.navigation) || avp.isMiddleClick(event))) {
            this.onMouseDownRightClick(event);
            return;
        }
        
        this.isMouseDown = true;
        this.editor.onMouseDown(event);
        event.preventDefault();
    };

    proto.onMouseUp = function(event) {

        processMouseEvent(this, event);

        if (!av.isMobileDevice() && (avp.isRightClick(event, this.editor.viewer.navigation) || avp.isMiddleClick(event))) {
            this.onMouseUpRightClick(event);
            return;
        }

        this.isMouseDown = false;
        this.editor.onMouseUp(event);
        event.preventDefault();
    };

    proto.onMouseDoubleClick = function(event) {

        processMouseEvent(this, event);
        this.editor.onMouseDoubleClick(event);
        event.preventDefault();
    };

    proto.onTouchDrag = function(event) {

        convertEventHammerToMouse(event);
        switch (event.type) {
          case 'dragstart':
                this.onMouseDown(event);
                break;
            case 'dragmove':
                this.onMouseMove(event);
                break;
           case 'dragend':
                this.onMouseUp(event);
                break;
        }
        event.preventDefault();
    };

    proto.onTouchPan = function(event) {

        var gestureHandler = this.editor.viewer.toolController.getTool("gestures");
        gestureHandler.distributeGesture(event);
        event.preventDefault();
    };

    proto.onTouchPinch = function(event) {

        processMouseEvent(this, event);

        var gestureHandler = this.editor.viewer.toolController.getTool("gestures");
        gestureHandler.distributeGesture(event);
        
        this.mousePosition.x = this.mousePosition.y = null;
        this.editor.callSnapperMouseMove();

        event.preventDefault();
    };

    proto.onSingleTap = function(event) {

        convertEventHammerToMouse(event);

        this.onMouseDown(event);
        this.onMouseUp(event);
        event.preventDefault();
    };

    proto.onDoubleTap = function(event) {

        convertEventHammerToMouse(event);
        this.onMouseDoubleClick(event);
        event.preventDefault();
    };

    function processMouseEvent(input, event) {

        var rect = input.editor.svg.getBoundingClientRect();

        input.makeSameXY = event.shiftKey;
        input.snapRotations = event.shiftKey;
        input.keepAspectRatio = event.shiftKey;
        input.constrainAxis = event.shiftKey;

        input.mousePosition.x = event.clientX - rect.left;
        input.mousePosition.y = event.clientY - rect.top;
    }

    function convertEventHammerToMouse(event) {

        // Convert Hammer touch-event X,Y into mouse-event X,Y.
        event.shiftKey = false;
        event.clientX = event.pointers[0].clientX;
        event.clientY = event.pointers[0].clientY;
    }
