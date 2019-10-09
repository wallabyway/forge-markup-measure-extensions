'use strict';

    var avp = Autodesk.Viewing.Private;

    export function MarkupTool() {

        Autodesk.Viewing.ToolInterface.call(this);
        this.names = ["markups.core"];
        this.panTool = null;
        this.allowNav = false;
        this.is2d = false;

        this.coreExt = null;
        this.hotkeysEnabled = true;

        var _ctrlDown = false;
        var _shiftDown = false;

        // Non-ToolInterface methods //

        this.allowNavigation = function(allow) {
            this.allowNav = allow;
        };
        this.setCoreExtension = function(coreExt) {
            this.coreExt = coreExt;
        };
        this.setHotkeysEnabled = function(enabled) {
            this.hotkeysEnabled = enabled;
        };


        // ToolInterface methods //

        this.activate = function(name, viewerApi) {
            this.panTool = viewerApi.toolController.getTool("pan");
            if (this.panTool) {
                this.panTool.activate("pan"); // TODO: What if we want "zoom" here?
            }

            this.is2d = viewerApi.model.is2d();
            this.viewer = viewerApi;
        };

        this.deactivate = function(name) {
            if (this.panTool) {
                this.panTool.deactivate("pan");
            }
        };

        this.handleKeyDown = function(event, keyCode) {

            if (!this.coreExt.editMode) {
                return false;
            }

            if (!this.hotkeysEnabled) {
                return true; // Consume event
            }

            // Don't propagate key handling down to tool //

            switch (keyCode) {
                case Autodesk.Viewing.KeyCode.CONTROL: _ctrlDown = true; break;
                case Autodesk.Viewing.KeyCode.SHIFT: _shiftDown = true; break;

                case Autodesk.Viewing.KeyCode.x: _ctrlDown && !this.allowNav && this.coreExt.cut(); break;
                case Autodesk.Viewing.KeyCode.c: _ctrlDown && !this.allowNav && this.coreExt.copy(); break;
                case Autodesk.Viewing.KeyCode.v: _ctrlDown && !this.allowNav && this.coreExt.paste(); break;
                case Autodesk.Viewing.KeyCode.d:
                    if (_ctrlDown && !this.allowNav) {
                        // Duplicate
                        this.coreExt.copy();
                        this.coreExt.paste();
                    }
                    break;
                case Autodesk.Viewing.KeyCode.z:
                    if (_ctrlDown && !_shiftDown && !this.allowNav) {
                        this.coreExt.undo();
                    }
                    else if (_ctrlDown && _shiftDown && !this.allowNav) {
                        this.coreExt.redo(); // Also support Ctrl+Y
                    }
                    break;
                case Autodesk.Viewing.KeyCode.y: _ctrlDown && !this.allowNav && this.coreExt.redo(); break; // Also support ctrl+shift+z
                case Autodesk.Viewing.KeyCode.ESCAPE: this.coreExt.onUserCancel(); break;

                case Autodesk.Viewing.KeyCode.BACKSPACE: // Fall through
                case Autodesk.Viewing.KeyCode.DELETE:
                    var selectedMarkup = this.coreExt.getSelection();
                    if (selectedMarkup) {
                        this.coreExt.deleteMarkup(selectedMarkup);
                    }
                    break;
                case Autodesk.Viewing.KeyCode.F12:
                    return false; // To allow opening developer console.
                    break;
                default: break;
            }

            return true; // Consume event
        };
        this.handleKeyUp = function(event, keyCode) {

            if (!this.coreExt.editMode) {
                return false;
            }

            if (!this.hotkeysEnabled) {
                return true; // Consume event
            }

            // Don't propagate key handling down to tool

            switch (keyCode) {
                case Autodesk.Viewing.KeyCode.CONTROL: _ctrlDown = false; break;
                case Autodesk.Viewing.KeyCode.SHIFT: _shiftDown = false; break;
                default: break;
            }

            return true; // Consume event ONLY
        };

        this.update = function() {
            if (this.allowNav && this.panTool && this.panTool.update) {
                return this.panTool.update();
            }
            return false;
        };

        this.handleSingleClick = function( event, button ) {
            if (this.allowNav) {
                // If pan tool won't handle single click, then pass over the event.
                if (this.panTool && this.panTool.handleSingleClick)
                    return this.panTool.handleSingleClick(event, button);
                else
                    return false;
            }
            return true; // Consume event
        };
        this.handleDoubleClick = function( event, button ) {
            if (this.allowNav) {
                // If pan tool won't handle double click, then pass over the event
                if (this.panTool && this.panTool.handleDoubleClick) {
                    return this.panTool.handleDoubleClick(event, button);
                }
                else
                    return false;
            }
            return true; // Consume event
        };
        this.handleSingleTap = function( event ) {
            if (this.allowNav) {
                // If pan tool won't handle single tap, then pass over the event
                if (this.panTool && this.panTool.handleSingleTap) {
                    return this.panTool.handleSingleTap(event);
                }
                else
                    return false;
            }
            return true; // Consume event
        };
        this.handleDoubleTap = function( event ) {
            if (this.allowNav) {
                // If pan tool won't handle double tap, then pass over the event
                if (this.panTool && this.panTool.handleDoubleTap) {
                    return this.panTool.handleDoubleTap(event);
                }
                else
                    return false;
            }
            return true; // Consume event
        };
        this.handleWheelInput = function(delta, event) {
            if (this.allowNav || this.is2d) {
                // If pan tool won't handle wheel input, then pass over the event
                if (this.panTool && this.panTool.handleWheelInput) {
                    this.coreExt.callSnapperMouseMove();
                    return this.panTool.handleWheelInput(delta, event);
                }
                else
                    return false;
            }
            return true; // Consume event
        };
        this.handleButtonDown = function(event, button) {
            if (this.allowNav || (this.is2d && (avp.isRightClick(event, this.viewer.navigation) || avp.isMiddleClick(event)))) {
                // If pan tool won't handle button down, then pass over the event
                if (this.panTool && this.panTool.handleButtonDown) {
                    return this.panTool.handleButtonDown(event, button);
                }
                else
                    return false;
            }
            return true; // Consume event
        };
        this.handleButtonUp = function(event, button) {
            if (this.allowNav || (this.is2d && (avp.isRightClick(event, this.viewer.navigation) || avp.isMiddleClick(event)))) {
                // If pan tool won't handle button up, then pass over the event
                if (this.panTool && this.panTool.handleButtonUp) {
                    return this.panTool.handleButtonUp(event, button);
                }
                else
                    return false;
            }
            return true; // Consume event
        };
        this.handleMouseMove = function(event) {
            if (this.allowNav || this.is2d) {
                // If pan tool won't handle button move, then pass over the event
                if (this.panTool && this.panTool.handleMouseMove) {
                    return this.panTool.handleMouseMove(event);
                }
                else
                    return false;
            }
            return true; // Consume event
        };
        this.handleGesture = function(event) {
            if (this.allowNav || this.is2d) {
                // If pan tool won't handle gesture, then pass over the event
                if (this.panTool && this.panTool.handleGesture) {
                    return this.panTool.handleGesture(event);
                }
                else
                    return false;
            }
            return true; // Consume event
        };
        this.handleBlur = function(event) {
            if (this.allowNav) {
                // If pan tool won't handle blur, then pass over the event
                if (this.panTool && this.panTool.handleBlur) {
                    return this.panTool.handleBlur(event);
                }
                else
                    return false;
            }
            return true; // Consume event
        };
    }
