import { Indicator } from './Indicator'

    var av = Autodesk.Viewing;
    var MeasureCommon = Autodesk.Viewing.MeasureCommon;

    // /** @constructor */
    export function CalibrationToolIndicator(viewer, measurement, calibrationTool)
    {
        Indicator.call(this, viewer, measurement, calibrationTool);
        this.calibrationTool = calibrationTool;
        this.calibrationLabel = null;
        this.endpoints = null;
        this.tmpVector = new THREE.Vector3();
        this.p1 = null;
        this.p2 = null;

        this.rubberbandDefaultMaterial = new THREE.MeshBasicMaterial({
            color: 0xe8b22c,
            opacity: 1,
            transparent: false,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        this.rubberbandSnappedMaterial = new THREE.MeshBasicMaterial({
            color: 0x005BCE,
            opacity: 1,
            transparent: false,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        this.rubberbandTipMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            opacity: 1,
            transparent: false,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });

    }

    CalibrationToolIndicator.prototype = Object.create(Indicator.prototype);
    CalibrationToolIndicator.prototype.constructor = CalibrationToolIndicator;
    var proto = CalibrationToolIndicator.prototype;
    
    var kEndpointOffset = 15;
    
    var kCrossWidth = 1.5;
    var kTipXWidth = 2;
    var kLineWidth = 3;

    var kTipXLength = 3;
    var kCrossLength = 5;

    var kDashSize = 2;
    var kGapSize = 1;

    proto.createEndpoint = function(name) {
        this.endpoints[name] = {};
        this.endpoints[name].position = null;

        const _document = this.getDocument();
        var label = this.endpoints[name].label = _document.createElement('div');
        label.className = 'calibration-endpoint';

        this.viewer.container.appendChild(label);

        var text = _document.createElement('div');
        text.className = 'calibration-endpoint-text';
        text.textContent = name.toString();
        label.appendChild(text);
        
        if (av.isTouchDevice()) {
            this.initLabelMobileGestures(label, name, this.calibrationTool);
        }
        // Disable hover for mobile devices
        if(!av.isMobileDevice()) {
            MeasureCommon.safeToggle(label, 'enable-hover', true);

            this.initMouseEvent(label, name);
    
            label.addEventListener('mousewheel', this.viewer.toolController.mousewheel);
            
        }   
    };

    proto.init = function() {

        MeasureCommon.createCommonOverlay(this.viewer, this.overlayName);
        
        if (!this.calibrationLabel) {
            const _document = this.getDocument();
            this.calibrationLabel = _document.createElement('div');
            this.calibrationLabel.className = 'calibration-label';
            this.hideLabel(this.calibrationLabel);
            this.viewer.container.appendChild(this.calibrationLabel);
            this.calibrationLabel.addEventListener('mousewheel', this.viewer.toolController.mousewheel);

            var text = _document.createElement('div');
            text.className = 'calibration-label-text';
            this.calibrationLabel.appendChild(text);
        }

        this.endpoints = [];

        this.handleButtonUpBinded = this.calibrationTool.handleButtonUp.bind(this.calibrationTool);
        this.addWindowEventListener('mouseup', this.handleButtonUpBinded);

        this.onCameraChangeBinded = this.onCameraChange.bind(this);
        this.viewer.addEventListener(av.CAMERA_CHANGE_EVENT, this.onCameraChangeBinded);
    };

    proto.destroy = function() {
        this.clear();

        Indicator.prototype.destroy.call(this);

        if (this.calibrationLabel) {
            this.calibrationLabel.removeEventListener('mousewheel', this.viewer.toolController.mousewheel);
            this.viewer.container.removeChild(this.calibrationLabel);
            this.calibrationLabel = null;
        }

        
        this.viewer.impl.clearOverlay(this.overlayName);
        this.viewer.impl.removeOverlayScene(this.overlayName);
        
        this.removeWindowEventListener('mouseup', this.handleButtonUpBinded);
        this.viewer.removeEventListener(av.CAMERA_CHANGE_EVENT, this.onCameraChangeBinded);
    };

    proto.clearRubberband = function() {
        this.viewer.impl.clearOverlay(this.overlayName);
    };

    proto.clear = function() {

        this.clearRubberband();
        
        this.hideLabel(this.calibrationLabel);
        
        for (var name in this.endpoints) {
            if (this.endpoints.hasOwnProperty(name)) {
                this.hideClick(name);
                this.endpoints[name].position = null;
            }
        }
    };

    proto.updateLabelValue = function(text) {
        if (!text || text === "") {
            this.calibrationLabel.childNodes[0].textContent = null;
            this.hideLabel(this.calibrationLabel);
        }
        else {
            this.calibrationLabel.childNodes[0].setAttribute("data-i18n", text);
            this.calibrationLabel.childNodes[0].textContent = av.i18n.translate(text);
            this.showLabel(this.calibrationLabel);
            this.calibrationTool.render();
        }
    };

    proto.changeLabelClickableMode = function(clickable) {
        if (clickable) {
            this.calibrationLabel.childNodes[0].style.pointerEvents='all';
        }
        else {
            this.calibrationLabel.childNodes[0].style.pointerEvents='none';
        }
    };

    proto.showAddCalibrationLabel = function() {
        var self = this;
        this.updateLabelValue("Add Calibration");
        this.changeLabelClickableMode(true);
        this.calibrationTool.render();
        
        this.calibrationLabel.addEventListener("click", function onClick() {
            self.calibrationLabel.childNodes[0].style.pointerEvents = 'none';
            self.calibrationTool.render();
            self.updateLabelValue(null);
            self.calibrationTool.showPanel();
            self.calibrationLabel.removeEventListener("click", onClick);
        });    
    };

    proto.updateLabelsPosition = function() {
        for (var i = 1; i <= Object.keys(this.endpoints).length; i++) {
            if (this.endpoints[i].position) {
                var label = this.endpoints[i].label;
                var pos = MeasureCommon.project(this.endpoints[i].position, this.viewer, kEndpointOffset);
                label.style.left = (pos.x - parseInt(label.clientWidth) / 2) + 'px';
                label.style.top = (pos.y - parseInt(label.clientHeight) / 2) + 'px';
                label.point = this.endpoints[i].position;

                // Detect and move in case of overlapping.
                this.labelsOverlapDetection(this.endpoints[i].label, this.endpoints);
            }
        }

        this.hideLabelsOutsideOfView();
    };

    function isLeftIntersect(current, other) {
        return current.right >= other.left && current.right <= other.right;
    }

    function isRightIntersect(current, other) {
        return current.left >= other.left && current.left <= other.right;
    }

    function isMiddleIntersect(current, other) {
        return current.left <= other.left && current.right >= other.right;
    }

    function isVerticalIntersect(current, other) {
        return current.top < other.bottom && current.bottom > other.top;
    }

    function moveLeft(currentLabel, currentRect, otherRect) {
        currentLabel.style.left = parseInt(currentLabel.style.left, 10) - (currentRect.right - otherRect.left) + 'px';
    }

    function moveRight(currentLabel, currentRect, otherRect) {
        currentLabel.style.left = parseInt(currentLabel.style.left, 10) + (otherRect.right - currentRect.left) + 'px';
    }

    function moveDown(currentLabel, currentRect, otherRect) {
        currentLabel.style.top = parseInt(currentLabel.style.top, 10) + (otherRect.bottom - currentRect.top) + 'px';
    }


    proto.labelsOverlapDetection = function(staticLabel, labelsList) {

        for (var i = 1; i <= Object.keys(labelsList).length ; i++) {

            var dynamicLabel = labelsList[i].label;

            if (staticLabel !== dynamicLabel) {
                var staticRect = staticLabel.getBoundingClientRect();
                var dynamicRect = dynamicLabel.getBoundingClientRect();

                if (isVerticalIntersect(dynamicRect, staticRect)) {

                    if (isLeftIntersect(dynamicRect, staticRect)) {
                        moveLeft(dynamicLabel, dynamicRect, staticRect);
                    }
                    else if (isRightIntersect(dynamicRect, staticRect)) {
                        moveRight(dynamicLabel, dynamicRect, staticRect);
                    }
                    else if (isMiddleIntersect(dynamicRect, staticRect)) {
                        moveDown(dynamicLabel, dynamicRect, staticRect);
                    }
                }
            }
        }
    };

    proto.renderCalibrationLabel = function() {

        if (this.showMeasureResult && this.calibrationLabel && this.p1 && this.p2) {
            
            var point = { x: (this.p1.x + this.p2.x)/2, y: (this.p1.y + this.p2.y)/2, z: (this.p1.z + this.p2.z)/2 };
            var mid = MeasureCommon.project(point, this.viewer);

            this.labelPosition = new THREE.Vector2(mid.x, mid.y);

            if (this.calibrationLabel.childNodes[0].textContent) {
                this.showLabel(this.calibrationLabel);
            }

            this.calibrationLabel.style.top  = this.labelPosition.y - Math.floor(this.calibrationLabel.clientHeight / 2) + 'px';
            this.calibrationLabel.style.left = this.labelPosition.x - Math.floor(this.calibrationLabel.clientWidth / 2) + 'px' ;
            this.calibrationLabel.point = point;

            if (this.viewer.model.is2d()) {
                this.alignLabelWithLine(this.calibrationLabel, this.p1, this.p2, this.calibrationLabel.clientHeight, this.viewer);
            }
        }
    };

    proto.drawMeasurementLineTip = function(point, direction, normal, flip) {

        var tmpVec = new THREE.Vector3();
        var geometry = new THREE.Geometry();
        var p1Scale = this.setScale(point);

        flip = flip ? -1 : 1;

        var tipMaterial = (this.snapper.isSnapped() && !this.showMeasureResult) ? this.rubberbandSnappedMaterial : this.rubberbandTipMaterial;

        // black tip
        tmpVec.addVectors(point, normal.clone().multiplyScalar(kCrossLength * p1Scale));
        geometry.vertices[0] = tmpVec.clone();
        tmpVec.subVectors(point, normal.clone().multiplyScalar(kCrossLength * p1Scale));
        geometry.vertices[1] = tmpVec.clone();
        this.drawLineAsCylinder(geometry, tipMaterial, kCrossWidth, this.overlayName);

        geometry.vertices[0] = point;
        tmpVec.subVectors(point, direction.clone().multiplyScalar(kCrossLength * p1Scale * flip));
        geometry.vertices[1] = tmpVec.clone();
        this.drawLineAsCylinder(geometry, tipMaterial, kCrossWidth, this.overlayName);

        // yellow tip
        tmpVec.addVectors(point, normal.clone().multiplyScalar(kTipXLength * p1Scale));
        geometry.vertices[0] = tmpVec.clone();
        tmpVec.subVectors(point, normal.clone().multiplyScalar(kTipXLength * p1Scale));
        geometry.vertices[1] = tmpVec.clone();
        this.drawLineAsCylinder(geometry, this.rubberbandDefaultMaterial, kTipXWidth, this.overlayName);

        tmpVec.addVectors(point, normal.clone().multiplyScalar(kTipXLength * p1Scale));
        tmpVec.addVectors(tmpVec, direction.clone().multiplyScalar(kTipXLength * p1Scale));
        geometry.vertices[0] = tmpVec.clone();
        tmpVec.subVectors(point, normal.clone().multiplyScalar(kTipXLength * p1Scale));
        tmpVec.subVectors(tmpVec, direction.clone().multiplyScalar(kTipXLength * p1Scale));
        geometry.vertices[1] = tmpVec.clone();
        this.drawLineAsCylinder(geometry, this.rubberbandDefaultMaterial, kTipXWidth, this.overlayName);
    };

    proto.renderDistanceMeasurement = function(p1, p2) {

        this.viewer.impl.clearOverlay(this.overlayName);

        if (!p1 || !p2)
            return;

        var geometry = new THREE.Geometry();
        var lineDirection = new THREE.Vector3().subVectors(p2, p1).normalize();
        var lineNormal = lineDirection.clone().cross(this.viewer.navigation.getEyeVector()).normalize();
        var p1Scale = this.setScale(p1);
        
        var dashSize = kDashSize * p1Scale;
        var gapSize = kGapSize * p1Scale;

        // Main line
        
        var lineMaterial = ((Math.abs(p1.x - p2.x) <= 0.1 || Math.abs(p1.y - p2.y) <= 0.1 
                            || this.snapper.getSnapResult().isPerpendicular) && !this.showMeasureResult) 
                            ? this.rubberbandSnappedMaterial : this.rubberbandDefaultMaterial;

        if (this.showMeasureResult) {
            // Single solid line.
            geometry.vertices[0] = p1;
            geometry.vertices[1] = p2;
            this.drawLineAsCylinder(geometry, lineMaterial, kLineWidth, this.overlayName);
        }
        else {
            this.drawDashedLine(p1, p2, dashSize, gapSize, lineMaterial, kLineWidth, this.overlayName); 
        }
        
        this.drawMeasurementLineTip(p1, lineDirection, lineNormal, false);
        
        if (this.showMeasureResult) {
            this.drawMeasurementLineTip(p2, lineDirection, lineNormal, true);
        }

        this.p1 = p1;
        this.p2 = p2;

        this.renderCalibrationLabel();
    };

    proto.onCameraChange = function() {
        if (this.measurement.isComplete()) {
            this.renderDistanceMeasurement(this.p1, this.p2);
        }   
        this.updateLabelsPosition();         
    };

