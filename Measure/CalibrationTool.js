import { CalibrationToolIndicator } from './CalibrationToolIndicator'
import { CalibrationPanel } from './CalibrationPanels'

const av = Autodesk.Viewing;

//
// /** @constructor */
//
//
export var CalibrationTool = function( viewer, options, sharedMeasureConfig, snapper)
{   
    var av = Autodesk.Viewing;
    var avem = Autodesk.Viewing.Extensions.Measure;
    var MeasureCommon = Autodesk.Viewing.MeasureCommon;

    var _names  = ["calibration"];
    var _priority = 50;
    var _viewer  = viewer;
    var _measurement = new MeasureCommon.Measurement(MeasureCommon.MeasurementTypes.MEASUREMENT_DISTANCE);
    var _options = options || {};

    this.setGlobalManager(viewer.globalManager);

    // Shared State with MeasureTool and Indicator
    var _sharedMeasureConfig = sharedMeasureConfig;

    var _maxPrecision = options.maxPrecision || 5;
    var _isCalibrated = (sharedMeasureConfig.calibrationFactor != null); // True when the user set the calibration, or used a Previous calibration factor.
    
    var _snapper = snapper;

    var _active = false;
    var _isDragging = false;
    var _isPressing = false;

    var _distance = null; // The length of the current measurement.
    var _calibrationTaken = false; // True when the user selected two valid points and set the calibration.
    var _selectedSize = null;
    var _selectedUnits = null;
    var _selectedP1 = null;
    var _selectedP2 = null;
    var _waitingForInput = false; // True when the user selected two valid points.
    var _picksBackup = [];
    var _cursorPosition = null;

    var _activePoint = 0;
    
    var _endpointMoved = false;

    var _consumeSingleClick = false;
    var _singleClickHandled = false;
    var _downX = null;
    var _downY = null;

    // GUI.
    var _calibrationPanel = null;
    var _cursor = "url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAYCAYAAAD+vg1LAAAAAXNSR0IArs4c6QAAAwZJREFUSA2tVEtLW0EUvjGJefoqSY0x0WBSiY+oNWiUINkU6ioLaaAlG1eudNVFoT+grgopiCkEIbUK1o0lusmurRSEWmmKG6MNtNhNosWqyU2CZPpN8cr15nFD7YHDzHnON2fOGYZhmHkw4XEW+wD4xkT4lMvl6CE0+Y2ohh+dz+cZn89HVS/5+n/d/wVMkXq9Xor2v5SBgsmymQwZHx+vOqlKpXKDXWI3eU6Tg+kqSjSh3W4/s9lsvzUajaNcAK3xY7Dyci3nd6WXSCS60dHRvMfjSRcKBfWV4SYbrVarB8p0PB5nY7HYmdVq/aDX67WlckpKKcvpOjs7X09OTvoPDw8z2Wy2Bu+imJqa+npycnJXGHOt3YRGoSyVSvvMZrNkYWFBs7GxkaoBAXFJcDJhcCW5rq5ur62trQ/EOhyOBhDT2Nj4qVKMqA31ve1yub7Rfufo/PycDA4OxpuamhqECaouhVqtfuD3+1tqa2uZQCCQDoVCWTwknVQDDvIKE1clI1ja09Ozg0cjx8fHpL+/P+50OhMU8f7+Punt7f2I5NdqXRXi9fV1z9jYWCuIWV5eziSTyWAqlXq1urqaw6AwOMiCG4lOYtEturu732xubhK0FQHSvfr6+lsog4HWPIPvIBqNErRiqCiwkkKpVFowZd8xZSQYDLImk+kJ52+xWJ4tLS3hU8yTkZGRBD2Ms4mu6Nun4XA4f3p6SoaGhuJ0+rgg/Bsmt9udYFmWzM3NZdDT05ztWsE5JV0R1AqUCfTt0fb2tjESiRRmZmaOUOcI3w9DY5mdnb03PDzMoDQ/MZFRzM20lO/E38vl8vt46UdAq0WNJWixlEwmu8B1bXioOxwjpgXJ0hMTE1og1qysrDghf+HnKtoD7c7u7i5ZXFzMGY3GF7iFuRR3dHTMr62tXWxtbZH29vZ3RYmECozu54ODAzpdP2hphHZOVigUVjChvgMDA+85fdm1q6vrrU6n+4WR9Zd1ujQ0Nzc/NBgMScSExXwZ2j5oL5Wo46UD/ZvxUemo+AdW1zJzUYr16wAAAABJRU5ErkJggg==), auto";
    var _hasUI = Autodesk.Viewing.GuiViewer3D && viewer instanceof Autodesk.Viewing.GuiViewer3D;

    var MeasureCommon = Autodesk.Viewing.MeasureCommon;

    function getActivePick()
    {
        switch (_activePoint) {
            case 0:
                return null;
            case 1:
            case 2:
                return _measurement.getPick(_activePoint);
            case 3:
                return _measurement.getPick(_measurement.countPicks());
        }
    }

    function getPreviousPick()
    {
        switch (_activePoint) {
            case 0:
                return null;
            case 1:
                return _measurement.getPick(_measurement.countPicks());
            case 2:
            case 3:
                return _measurement.getPick(1);
        }
    }

    function hasPreviousPick()
    {
        switch (_activePoint) {
            case 0:
                return false;
            case 1:
                return _measurement.hasPick(_measurement.countPicks());
            case 2:
            case 3:
                return _measurement.hasPick(1);
        }
    }

    function noPicksSet() {
        _activePoint = 0;
    }

    function allPicksSet() {
        _activePoint = 3;
        _measurement.indicator.changeAllEndpointsEditableStyle(true);
    }

    function isNoPicksSet() {
        return _activePoint === 0;
    }

    function areAllPicksSet() {
        return _activePoint === 3;   
    }

    this.register = function()
    {
        if (_hasUI && !_calibrationPanel) {
            _calibrationPanel = new CalibrationPanel( this, _viewer, "calibration-panel", "Calibration", _options );
            _viewer.addPanel(_calibrationPanel);
        }

        this.onCameraChangeBinded = this.onCameraChange.bind(this);
        this.screenSizeChangedBinded = this.screenSizeChanged.bind(this);
    };

    this.deregister = function()
    {   
        this.deactivate();
        
        if (_calibrationPanel) {
            _viewer.removePanel( _calibrationPanel );
            _calibrationPanel.uninitialize();
            _calibrationPanel = null;
        }
    };

    this.isActive = function()
    {
        return _active;
    };

    this.getNames = function()
    {
        return _names;
    };

    this.getName = function()
    {
        return _names[0];
    };

    this.getPriority = function()
    {
        return _priority;
    };

    this.getCursor = function() {
        return _isDragging ? null : _cursor;
    };

    this.activate = function()
    {
        _active = true;
        _isDragging = false;
        this.isEditingEndpoint = false;
        this.editByDrag = false;
        noPicksSet();

        _viewer.toolController.activateTool(_snapper.getName());
        _viewer.toolController.activateTool("magnifyingGlass");


        if (!_measurement.indicator) {
            _measurement.attachIndicator(_viewer, this, CalibrationToolIndicator);
        }

        _measurement.indicator.clear();

        if (_calibrationTaken && _selectedP1 && _selectedP2) {
            _measurement.setPick(1, _selectedP1.clone());
            _measurement.setPick(2, _selectedP2.clone());

            allPicksSet();

            var parsedRequestedSize = Autodesk.Viewing.Private.UnitParser.parsePositiveNumber(_selectedSize, _selectedUnits);
            _measurement.indicator.updateLabelValue(Autodesk.Viewing.Private.formatValueWithUnits(parsedRequestedSize, _selectedUnits, 3, _sharedMeasureConfig.precision));
            _distance = _measurement.distanceXYZ;
            _measurement.indicator.changeLabelClickableMode(false);
            _waitingForInput = true;
            var valid = this.render();
            _measurement.indicator.changeAllEndpointsEditableStyle(true);

            if (valid) {
                if (_calibrationPanel) {
                    _calibrationPanel.setPanelValue(_selectedSize);
                }
                
                this.showPanel();
            }
        }

        _viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.onCameraChangeBinded);
        _viewer.addEventListener(Autodesk.Viewing.VIEWER_RESIZE_EVENT, this.screenSizeChangedBinded);
    };

    this.deactivate = function()
    {   
        if (!_active)
            return;

        _active = false;

        this.hidePanel();
        this.updateViewportId(true);
        _waitingForInput = false;
        _measurement.clearAllPicks();

        if(_snapper && _snapper.isActive()) {
            _viewer.toolController.deactivateTool(_snapper.getName());
        }

        _viewer.toolController.deactivateTool("magnifyingGlass");

        if (_measurement.indicator) {
            _measurement.indicator.clear();
            _measurement.indicator.destroy();
            _measurement.indicator = null;
        }

        _viewer.removeEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.onCameraChangeBinded);
        _viewer.removeEventListener(Autodesk.Viewing.VIEWER_RESIZE_EVENT, this.screenSizeChangedBinded);
    };

    this.getActivePointIndex = function() {
        return _activePoint;
    };

    this.setCalibrationFactor = function ( calibrationFactor ) {
        _sharedMeasureConfig.calibrationFactor = calibrationFactor;
    };

    this.getCalibrationFactor = function () {
        return _sharedMeasureConfig.calibrationFactor;
    };

    this.updateLabelValue = function (value) {
        _measurement.indicator.updateLabelValue(value);
    };

    this.isCalibrationValid = function(requestedUnits, requestedSize) { 
        var parsedRequestedSize = Autodesk.Viewing.Private.UnitParser.parsePositiveNumber(requestedSize, requestedUnits); 
        return !isNaN(parsedRequestedSize); 
    };

    this.calibrate = function(requestedUnits, requestedSize)
    {

        var calibrationFactor = null;
        
        var parsedRequestedSize = Autodesk.Viewing.Private.UnitParser.parsePositiveNumber(requestedSize, requestedUnits);

        if (!isNaN(parsedRequestedSize)) {
            var currentSize = Autodesk.Viewing.Private.convertUnits(_viewer.model.getUnitString(), requestedUnits, 1, _distance);
            if (currentSize !== 0 && !isNaN(currentSize)) {
                calibrationFactor = parsedRequestedSize / currentSize;
                _sharedMeasureConfig.calibrationFactor = calibrationFactor;
                _sharedMeasureConfig.units = requestedUnits;
                var defualtPrecision = _viewer.model.is2d() ? 3 : 1;
                var requestedPrecision = Autodesk.Viewing.Private.calculatePrecision(requestedSize);
                _sharedMeasureConfig.precision = Math.max((_sharedMeasureConfig.precision ? _sharedMeasureConfig.precision : defualtPrecision), requestedPrecision);
                _selectedSize = requestedSize;
                _selectedUnits = requestedUnits;
                _isCalibrated = true;
                _calibrationTaken = true;
                _selectedP1 = _measurement.getPick(1).clone();
                _selectedP2 = _measurement.getPick(2).clone();
            }
        }
        
        if (calibrationFactor) {
            _viewer.getExtension('Autodesk.Measure').enableCalibrationTool(false);
            _viewer.dispatchEvent({ type: MeasureCommon.Events.FINISHED_CALIBRATION , units: requestedUnits , scaleFactor: calibrationFactor, size: requestedSize});
        }
    };

    this.calibrateByScale = function(requestedUnits, requestedScale) {
        _sharedMeasureConfig.calibrationFactor = requestedScale;
        
        if (_sharedMeasureConfig.units !== requestedUnits ) {
            _sharedMeasureConfig.units = requestedUnits;
            _selectedUnits = requestedUnits;
        }

        _isCalibrated = true;
    };

    this.getCurrentUnits = function () {
        return _sharedMeasureConfig.units;
    };

    this.hidePanel = function() {
        if (_calibrationPanel) {
            _calibrationPanel.setVisible(false);
        }
        else {
            _viewer.dispatchEvent({ type: MeasureCommon.Events.CLOSE_CALIBRATION_PANEL_EVENT });
        }
    };

    this.showPanel = function() {

        var self = this;
        const _window = this.getWindow();

        if (_calibrationPanel) {
            _window.setTimeout(function () { _calibrationPanel.requestedSizeTextbox.focus();}, 0);
            _calibrationPanel.setVisible(true);
            _calibrationPanel.updatePanelPosition(_measurement.indicator.labelPosition, _measurement.indicator.p1, _measurement.indicator.p2, _measurement.indicator.calibrationLabel.clientHeight);
            self.addWindowEventListener("keyup", function onKeyUp(e){
                var key = e.key || String.fromCharCode(e.keyCode);
                if (key == "Escape" && self.isActive()) {
                    self.hidePanel();
                    self.clearSize();
                    self.showAddCalibrationLabel();
                    
                    self.removeWindowEventListener("keyup", onKeyUp);
                }
            });
        }
        else {
            _viewer.dispatchEvent({ type: MeasureCommon.Events.OPEN_CALIBRATION_PANEL_EVENT, data: {size: _selectedSize, units: _selectedUnits } });
        }
    };

    this.showAddCalibrationLabel = function() {
        _measurement.indicator.showAddCalibrationLabel();
    };

    this.isCalibrated = function() {
        return _isCalibrated;
    };

    this.clearSize = function () {
        _measurement.indicator.updateLabelValue(null);

        if (_calibrationPanel) {
            _calibrationPanel.requestedSizeTextbox.value = "";   
        }
        else {
            _viewer.dispatchEvent({ type: MeasureCommon.Events.CLEAR_CALIBRATION_SIZE_EVENT });
        }
    };

    this.getMaxPrecision = function() {
        return _maxPrecision;
    };
    
    this.clearMeasurement = function() {

        noPicksSet();

        this.clearPick(1);
        this.clearPick(2);

        _measurement.indicator.clear();
        
        this.updateViewportId(true);
        this.hidePanel();

        _waitingForInput = false;
    };

    this.clearPick = function(pickNumber) {
        if (_measurement.hasPick(pickNumber)) {
            _measurement.clearPick(pickNumber);
            _measurement.indicator.hideClick(pickNumber);
        }
    };

    this.repickEndpoint = function(pickNumber) {
        this.clearPick(pickNumber);
        this.editEndpoint(null, pickNumber);
    };

    this.getSnapper = function() {
        return _snapper;
    };

    this._handleMouseEvent = function (event) {

        var valid = false;

        if (_snapper.isSnapped()) {

            // User picked a new point after two points where already set (or none) - Start a new measurement.
            if (areAllPicksSet() || isNoPicksSet()) {
                this.clearMeasurement();
                _activePoint = 1;
            }
            
            _snapper.copyResults(getActivePick());

            valid = true;

        } 
        else { 
            // In order to draw rubber-band, set the cursor position, so the indicator will use it as active point.
            if (event && _viewer.model.is2d()) {
                var viewport = _viewer.container.getBoundingClientRect();
                var x = event.canvasX || event.clientX - viewport.left;
                var y = event.canvasY || event.clientY - viewport.top;

                if (x && y) {
                    _cursorPosition = MeasureCommon.inverseProject({ x:x, y:y }, _viewer);
                }
            }

            // In case a measurement is set, and the user clicks on a blank spot - don't do nothing.
            if (_consumeSingleClick && _measurement && !this.isEditingEndpoint) {
                if (_activePoint === _measurement.getMaxNumberOfPicks() + 1) {
                    return true;
                }
            }

            var lastPick = getActivePick();
            if (lastPick) {
                lastPick.clear();
            }
        }

        this.correctPickPosition();

        if (_consumeSingleClick) {
            this._doConsumeSingleClick(valid);
        }
        
        if (!isNoPicksSet()) {
            var renderSucceeded = this.render();

            // If it's the first pick, we don't expect the render of the rubberband to be succeeded.
            // So enter here only if it's not the first pick.
            if (_measurement.hasPick(2)) {
                valid &= renderSucceeded;
            }
        }

        if (_consumeSingleClick) {
            if (_measurement.isComplete() && valid) {
                _distance = _measurement.distanceXYZ;
                this.clearSize();
                this.showPanel();
                _waitingForInput = true;
            }
            else {
                this.hidePanel();
                _measurement.indicator.updateLabelValue(null);
                _waitingForInput = false;
            }
        }

        // If valid is false, the last pick is not revelant, and will clear it in case of a click.
        return valid;
    };

    this.updateViewportId = function(clear) {
        if (_viewer.model && _viewer.model.is2d()) {
            if (clear || isNoPicksSet()) {
                viewer.impl.updateViewportId(0);
                _snapper.setViewportId(null);
            }
            else if (!_isPressing) {
                var viewport = getPreviousPick().viewportIndex2d || getActivePick().viewportIndex2d;
                
                // Pass viewport Id to LineShader to make all other geometries with different viewport transparent
                viewer.impl.updateViewportId(viewport);
                if (_snapper)
                    _snapper.setViewportId(viewport);  
            
            }
        }
    };

    this._doConsumeSingleClick = function(valid) {

        this.updateViewportId(_measurement.isComplete());

        _measurement.indicator.clear();
    };


    this.handleButtonDown = function (event, button) {
        if (av.isMobileDevice()) 
            return false;

        _isDragging = true;
        if (button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
            _consumeSingleClick = true;
            _downX = event.canvasX;
            _downY = event.canvasY;
        }
        return false;
    };

    this.handleMouseMove = function (event) {
        if (av.isMobileDevice())
            return false;

        if (event.canvasX !== _downX || event.canvasY !== _downY) {
            _consumeSingleClick = false;    
        }

        _endpointMoved = this.isEditingEndpoint;    

        if (!isNoPicksSet() && !areAllPicksSet()) {
            this.clearPick(_activePoint);
            this._handleMouseEvent(event);
        }

        _snapper.indicator.render();
        
        return false;
    };

    this.restoreMouseListeners = function () {

        // When a press event has happend, the default behavior of firefly.js is to disable other mouse events,
        // So they won't be triggered as well.
        // The solution is to enable them after the end of the pressing.

        _viewer.toolController.getTool("gestures").controller.enableMouseButtons(true);
    };

    this.handlePressHold = function (event) {
        _consumeSingleClick = false;

        if (av.isTouchDevice()) {
            switch( event.type )
            {
                case "press":
                    _isPressing = true;
                    if (areAllPicksSet()) {
                        this.clearMeasurement();
                    } else {
                        this.clearPick(_activePoint);
                    }
                    this._handleMouseEvent(event);
                    _snapper.indicator.render();

                    return true;

                case "pressup":
                    _consumeSingleClick = true;
                    this.restoreMouseListeners();
                    _singleClickHandled = !_singleClickHandled;
                    this.handleSingleClick(event);
                    _isPressing = false;
                    return true;
            }
        }
        return false;

    };

    this.correctPickPosition = function() {
        
        var active = getActivePick();
            
        if (active && !active.getGeometry() && _cursorPosition) {
            active.geomType = MeasureCommon.SnapType.SNAP_VERTEX;
            active.geomVertex = _cursorPosition;
            active.intersectPoint = _cursorPosition;
        }

        if (hasPreviousPick()) {
            var passive = getPreviousPick();
            MeasureCommon.correctPerpendicularPicks(passive, active, viewer, _snapper);
        }
    };

    this.render = function() {

        var hasResult = _measurement.computeResult(_measurement.picks, _viewer, _snapper);
        _measurement.indicator.render(_measurement.picks, _consumeSingleClick || _waitingForInput);

        return hasResult;
    };

    this.editEndpoint = function(event, endpointNumber) {
        if (_activePoint === endpointNumber) {
            _measurement.indicator.changeEndpointOnEditStyle(endpointNumber, false);
            this.undoEditEndpoint();
            return;
        }

        _activePoint = endpointNumber;
        this.isEditingEndpoint = true;

        _measurement.indicator.changeEndpointOnEditStyle(endpointNumber, true);
        _measurement.indicator.changeAllEndpointsEditableStyle(false);

        for (var key in _measurement.picks) {
            if (_measurement.picks.hasOwnProperty(key)) {
                _picksBackup[key] = _measurement.getPick(key).clone();
            }
        }

        this.updateViewportId();

        this.hidePanel();
        _measurement.indicator.updateLabelValue(null);
        _waitingForInput = false;

        if(!av.isMobileDevice()) {
            this._handleMouseEvent(event);
        }
    };

    this.undoEditEndpoint = function() {
        _measurement.indicator.clear();

        for (var key in _measurement.picks) {
            if (_measurement.picks.hasOwnProperty(key)) {
                _measurement.setPick(key, _picksBackup[key].clone());
            }
        }
        
        this.updateViewportId(true);
        this.isEditingEndpoint = false;
        _waitingForInput = true;

        allPicksSet();
        var valid = this.render();
        
        if (valid) {
            this.showPanel();
        }
    };

    this.handleGesture = function(event)
    {   
        if (av.isTouchDevice()){
            
            _consumeSingleClick = false;
        
            if (_isPressing) {
                
                this.clearPick(_activePoint);

                switch( event.type )
                {
                    case "dragstart":
                        this._handleMouseEvent(event);
                        _snapper.indicator.render();

                        return true;

                    case "dragmove":
                        this._handleMouseEvent(event);
                        _snapper.indicator.render();

                        return true;

                    case "dragend":
                        _isPressing = false;
                        _consumeSingleClick = true;

                        if (!this.editByDrag) {
                            _singleClickHandled = !_singleClickHandled;
                            this.handleSingleClick(event);    
                        }

                        this.editByDrag = false;
                        this.restoreMouseListeners();
                        return true;

                    case "pinchend":
                        _consumeSingleClick = true;
                        _singleClickHandled = !_singleClickHandled;
                        this.handleSingleClick(event);
                        this.restoreMouseListeners();
                        return true;
                }
            }
        }

        return false;
    };

    this.handleButtonUp = function (event) {
        _isDragging = false;
        _downX = null;
        _downY = null;
        
        if (_endpointMoved) {
            _consumeSingleClick = true;
            _singleClickHandled = !_singleClickHandled;
            this.handleSingleClick(event);
            _endpointMoved = false;
        }

        return false;
    };

    this.handleSingleClick = function (event) {
        if (_consumeSingleClick) {
            
            _snapper.indicator.clearOverlays();

            _measurement.indicator.changeEndpointOnEditStyle(_activePoint, false);

            if (this._handleMouseEvent(event)) {
                _measurement.indicator.showEndpoints();
                _measurement.indicator.updateLabelsPosition();
                _activePoint++;
            }
            else {
                if (this.isEditingEndpoint) {
                    this.undoEditEndpoint();
                }
                else {
                    this.clearMeasurement();
                }
            }

            if (_measurement.isComplete()) {
                allPicksSet();
            }

            _consumeSingleClick = false;
            _singleClickHandled = !_singleClickHandled;
            this.isEditingEndpoint = false;

            _snapper.clearSnapped();
        }
        return true;
    };

    this.handleDoubleClick = function() {
        return true;
    };

    this.handleSingleTap = function (event) {
        if (!_singleClickHandled) {
            _consumeSingleClick = true;
            _snapper.onMouseDown({x: event.canvasX, y:event.canvasY});
            this.handleSingleClick(event);
        }
        _singleClickHandled = !_singleClickHandled;

        return true;
    };

    this.handleDoubleTap = function() {
        return true;
    };

    this.handleResize = function() {
        if (_measurement.indicator) {
            _measurement.indicator.handleResize();
        }
    };

    this.onCameraChange = function() {
        if (_snapper.indicator) {
            _snapper.indicator.onCameraChange();
        }
    };

    this.screenSizeChanged = function(event) {
        this.onCameraChange();
    };
};

av.GlobalManagerMixin.call(CalibrationTool.prototype);