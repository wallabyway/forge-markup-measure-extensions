
    var av = Autodesk.Viewing;
    var MeasureCommon = av.MeasureCommon;
    
    /**
     * Base class for an indicator.
     */

    export var Indicator = function(viewer, measurement, tool)
    {
        this.viewer = viewer;
        this.setGlobalManager(viewer.globalManager);
        this.measurement = measurement;
        this.tool = tool;
        this.snapper = tool.getSnapper();
        this.materialExtensionLine = null;
        this.materialExtensionFace = null;
        this.extensionLines = [];
        this.extensionFaces = [];
        this.grayOutPlane = [];
        this.materialPoint = null;
        this.materialLine = null;
        this.materialAngle = null;
        this.materialAngleOutline = null;
        this.materialGreyOutPlane = null;
        this.materialFace = null;
        this.angleArc = null;
        this.angleOutline = [];
        this.showMeasureResult = false;
        this.visibleLabels = [];
        this.overlayName = 'measure-indicator-overlay-' + (measurement.id || '');
        this.xAxis = this.viewer.autocam.getWorldRightVector();
        this.yAxis = this.viewer.autocam.getWorldUpVector();
        this.zAxis = this.viewer.autocam.getWorldFrontVector();
    };



    var proto = Indicator.prototype;
    av.GlobalManagerMixin.call(proto);

    proto.init = function() {
        return false;
    };

    proto.updateDistance = function() {
        return false;
    };

    proto.updateAngle = function() {
        return false;
    };

    proto.clear = function() {
        return false;
    };

    proto.updateLabelsPosition = function() {
        return false;
    };

    proto.renderFromPoints = function(points, showMeasureResult) {
        this.showMeasureResult = showMeasureResult;

        this.clear();

        for (var i = 1; i <= Object.keys(points).length; i++) {
            const p = points[i];
            if (!this.endpoints[i]) {
                this.createEndpoint(i);
            }
    
            this.endpoints[i].position = new THREE.Vector3(p.x, p.y, p.z);
            this.showClick(i);
        }
            
        this.renderRubberbandFromPoints(points);
        
        this.updateLabelsPosition();
    };

    // Renders the measurement and the labels.
    proto.render = function(picks, showMeasureResult) {

        this.showMeasureResult = showMeasureResult;

        this.clear();

        for (var i = 1; i <= Object.keys(picks).length; i++) {
            if (this.measurement.hasPick(i)) {
                this.renderPick(i);
            }
        }
            
        this.renderRubberband(picks);
        
        this.updateLabelsPosition();
    };

    proto.changeEndpointOnEditStyle = function(endpointNumber, isEditing) {
        return false;
    };

    proto.handleResize = function() {
        return false;
    };

    proto.setNoTopology = function() {
        return false;
    };

    proto.setFetchingTopology = function() {
        return false;
    };

    proto.setTopologyAvailable = function() {
        return false;
    };

    proto.clientToCanvasCoords = function(event) {
        var rect = this.viewer.impl.getCanvasBoundingClientRect();
        var res = {};
        if( event.hasOwnProperty("center") )
        {
            event.canvasX = res.x = event.center.x - rect.left;
            event.canvasY = res.y = event.center.y - rect.top;
        }
        else
        {
            event.canvasX = res.x = event.pointers[0].clientX - rect.left;
            event.canvasY = res.y = event.pointers[0].clientY - rect.top;
        }

        return res;
    };

    proto.initLabelMobileGestures = function(label, pointNumber) {
        var magnifyingGlass = this.viewer.toolController.getTool("magnifyingGlass");

        this.hammer = new av.Hammer.Manager(label, {
                recognizers: [
                    av.GestureRecognizers.drag,
                    av.GestureRecognizers.singletap
                ],
                handlePointerEventMouse: false,
                inputClass: av.isIE11 ? av.Hammer.PointerEventInput : av.Hammer.TouchInput
            });

        this.onSingleTapBinded = function(event) { 
                                    var pos = this.clientToCanvasCoords(event);
                                    this.snapper.onMouseDown(pos);
                                    this.tool.editEndpoint(event, pointNumber, this.measurement.id); 
                                }.bind(this);

        this.onDragStartBinded = function(event) {
                                    var pos = this.clientToCanvasCoords(event);
                                    this.snapper.onMouseDown(pos);
                                    this.tool.editEndpoint(event, pointNumber, this.measurement.id);
                                    this.tool.editByDrag = true;

                                    // Activate Magnifying Glass and tool by faking press event.
                                    event.type = "press";
                                    magnifyingGlass.handlePressHold(event);
                                    this.tool.handlePressHold(event);
                                    event.type = "dragstart";
                                    magnifyingGlass.handleGesture(event);
                                    this.tool.handleGesture(event);
                                }.bind(this);

        this.onDragMoveBinded = function(event){ 
                                    var pos = this.clientToCanvasCoords(event);
                                    this.snapper.onMouseDown(pos);

                                    magnifyingGlass.handleGesture(event);
                                    this.tool.handleGesture(event);
                                }.bind(this);

        this.onDragEndBinded = function(event){ 
                                    var pos = this.clientToCanvasCoords(event);
                                    this.snapper.onMouseDown(pos);
                                    
                                    // Deactivate Magnifying Glass and tool by faking pressup event.
                                    magnifyingGlass.handleGesture(event);
                                    this.tool.handleGesture(event);
                                    event.type = "pressup";
                                    magnifyingGlass.handlePressHold(event);
                                    this.tool.handlePressHold(event);

                                    this.tool.handleButtonUp(event);
                                }.bind(this);

        this.hammer.on("singletap", this.onSingleTapBinded);
        this.hammer.on("dragstart", this.onDragStartBinded);
        this.hammer.on("dragmove", this.onDragMoveBinded);
        this.hammer.on("dragend", this.onDragEndBinded);
    };

    proto.clearLabelMobileGestures = function() {
        if (this.hammer) {
            this.hammer.off("singletap", this.onSingleTapBinded);
            this.hammer.off("dragstart", this.onDragStartBinded);
            this.hammer.off("dragmove", this.onDragMoveBinded);
            this.hammer.off("dragend", this.onDragEndBinded);
            this.hammer = null;
        }
    };

    proto.updateVisibleLabelsArray = function(label, isVisible) {
        if (isVisible) {
            if (!(this.visibleLabels.indexOf(label) > -1)) {
                this.visibleLabels.push(label);        
            }
        } else {
            // remove from array
            var index = this.visibleLabels.indexOf(label);
            if (index > -1) {
                this.visibleLabels.splice(index, 1);
            }
        }
    };

    proto.hideEndpoints = function() {
        for (var name in this.endpoints) {
            if (this.endpoints.hasOwnProperty(name)) {
                var endpoint = this.endpoints[name];
                if (endpoint.label) {
                    this.hideLabel(endpoint.label);
                }
            }
        }
    };

    proto.showEndpoints = function() {
        for (var name in this.endpoints) {
            if (this.endpoints.hasOwnProperty(name)) {
                var endpoint = this.endpoints[name];
                if (this.measurement.hasPick(name) && endpoint.label) {
                    this.showLabel(endpoint.label);
                }
            }
        }
    };

    proto.hideLabel = function(label) {
        if (label) {
            MeasureCommon.safeToggle(label, 'visible', false);
            this.updateVisibleLabelsArray(label, false);      
        }
    };

    proto.showLabel = function(label) {
        if (label) {
            MeasureCommon.safeToggle(label, 'visible', true);
            this.updateVisibleLabelsArray(label, true);
        }
    };

    proto.changeEndpointOnEditStyle = function(endpointNumber, isEditing) {
        if (this.endpoints[endpointNumber] && this.endpoints[endpointNumber].label) {
            MeasureCommon.safeToggle(this.endpoints[endpointNumber].label, 'on-edit', isEditing);
        }
    };

    proto.changeEndpointEditableStyle = function(endpointNumber, isEditable) {
        if (this.endpoints[endpointNumber] && this.endpoints[endpointNumber].label) {
            MeasureCommon.safeToggle(this.endpoints[endpointNumber].label, 'editable', isEditable);
        }
    };

    proto.changeAllEndpointsEditableStyle = function(isEditable) {
        for (var name in this.endpoints) {
            if (this.endpoints.hasOwnProperty(name)) {
                this.changeEndpointEditableStyle(name, isEditable);    
            }
        }
    };

    proto.changeAllEndpointsOnEditStyle = function(isEditing) {
        for (var name in this.endpoints) {
            if (this.endpoints.hasOwnProperty(name)) {
                this.changeEndpointOnEditStyle(name, isEditing);
            }
        }
    };

    proto.hideLabelsOutsideOfView = function() {
        // For each label, check if it's inside the camera viewport.
        if (this.viewer.model && !this.viewer.model.is2d()) {
            this.visibleLabels.forEach(function(label) {

                // Ignore labels if position is not computed yet. This may temporarily happen, because label positions are not
                // always immediately assigned. (see MeasureToolIndicator.js)
                // Note that we must not set them to invisible here, because this may cause a hen-and-egg-problem: 
                // Some code sections in MeasureToolIndicator.updatePositions() don't set the label position for invisible labels.
                if (!label.point) {
                    return;
                }

                var show = this.viewer.navigation.isPointVisible(label.point);

                if ((label.classList.contains('visible') && !show) || (!label.classList.contains('visible') && show)) {
                    label.classList.toggle('visible', show);    
                } 

            }.bind(this));
        }
    };

    proto.showClick = function(pickNumber) {
        if (this.tool.getActivePointIndex() !== pickNumber) {
            this.showLabel(this.endpoints[pickNumber].label);
        }
    };

    proto.hideClick = function(pickNumber) {

        if (this.endpoints[pickNumber]) {
            this.hideLabel(this.endpoints[pickNumber].label);    
        }
    };

    proto.renderPick = function(pickNumber) {
        if (!this.endpoints[pickNumber]) {
            this.createEndpoint(pickNumber);
        }

        this.renderEndpointGeometry(pickNumber);
        this.showClick(pickNumber);
    };

    proto.renderEndpointGeometry = function(pickNumber) {
        var geometry = MeasureCommon.getSnapResultPosition(this.measurement.getPick(pickNumber), this.viewer);
        
        if (geometry !== null) {
            this.endpoints[pickNumber].position = geometry.clone();
        }
    };


    // This is a workaround to deal with the limitation on linewidth on Windows due to the ANGLE library
    proto.drawEdgeAsCylinder = function(geom, material, linewidth, type, cylinderGeometry) {

        // The array for all cylinders
        var edge = [];
        var cylinder;

        if (type == 1) { // LinePieces
            for (var i = 0; i < geom.vertices.length; i += 2) {
                cylinder = this.cylinderMesh(geom.vertices[i], geom.vertices[i + 1], material, linewidth, cylinderGeometry);
                this.setCylinderScale(cylinder, geom.vertices[i], geom.vertices[i + 1]);
                edge.push(cylinder);
            }
        }
        else { // LineStrip
            for (var i = 0; i < geom.vertices.length - 1; i++) {
                cylinder = this.cylinderMesh(geom.vertices[i], geom.vertices[i + 1], material, linewidth, cylinderGeometry);
                this.setCylinderScale(cylinder, geom.vertices[i], geom.vertices[i + 1]);
                edge.push(cylinder);
            }
        }


        return edge;
    };

    proto.drawDashedLine = function(p1, p2, dashSize, gapSize, material, width, overlayName) {

        var geometry = new THREE.Geometry();
        var line = new THREE.Vector3().subVectors(p2, p1);
        var lineLength = line.length() - gapSize;
        var lineDirection = line.normalize();
        
        var i = 0;
        var pos = p1.clone();
        var currLength = 0;

        while (currLength < lineLength) {
            var isPointVisible = this.viewer.navigation.isPointVisible(pos);
            
            if (isPointVisible) {
                geometry.vertices[i] = pos.clone();
                i++;
            }
            
            pos.addVectors(pos, lineDirection.clone().multiplyScalar(dashSize));
            
            if (isPointVisible) {
                geometry.vertices[i] = pos.clone();
                i++;
            }
            
            pos.addVectors(pos, lineDirection.clone().multiplyScalar(gapSize));

            currLength += dashSize + gapSize;
        }
        
        line = this.drawEdgeAsCylinder(geometry, material, width, 1, this.getNewCylinderGeometry());
        this.viewer.impl.addMultipleOverlays(overlayName, line);

        return line;
    };

    // This is a workaround to deal with the limitation on linewidth on Windows due to the ANGLE library
    proto.drawLineAsCylinder = function(geom, material, linewidth, overlayName) {

        var line;

        if (geom.vertices.length == 2) {
            line = this.cylinderMesh(geom.vertices[0], geom.vertices[1], material, linewidth, this.getNewCylinderGeometry());
            this.setCylinderScale(line, geom.vertices[0], geom.vertices[1]);
            this.viewer.impl.addOverlay(overlayName, line);
        }

        return line;
    };

    proto.getNewCylinderGeometry = function() {
        return new THREE.CylinderGeometry(0.1, 0.1, 1, 8, 1, true);
    };


    proto.cylinderMesh = function(pointX, pointY, material, linewidth, cylinderGeometry) {

        var direction = new THREE.Vector3().subVectors(pointY, pointX);
        var orientation = new THREE.Matrix4();
        orientation.lookAt(pointX, pointY, new THREE.Object3D().up);
        orientation.multiply(new THREE.Matrix4().set(linewidth, 0, 0, 0,
            0, 0, linewidth, 0,
            0, -direction.length(), 0, 0,
            0, 0, 0, 1));

        var edge = new THREE.Mesh(cylinderGeometry, material);
        edge.applyMatrix(orientation);
        edge.lmv_line_width = linewidth;
        edge.position.x = (pointY.x + pointX.x) / 2;
        edge.position.y = (pointY.y + pointX.y) / 2;
        edge.position.z = (pointY.z + pointX.z) / 2;

        return edge;
    };

    // Set scale for cylinder
    proto.setCylinderScale = function(cylinderMesh, p1, p2) {
        var scale;

        if (p1 && p2) {
            var point = MeasureCommon.nearestPointInPointToSegment(this.viewer.navigation.getPosition(), p1, p2);
            scale = this.setScale(point);    
        } else {
            scale = this.setScale(cylinderMesh.position);
        }

        if (cylinderMesh.hasOwnProperty("lmv_line_width"))
            scale *= cylinderMesh.lmv_line_width;
        cylinderMesh.scale.x = scale;
        cylinderMesh.scale.z = scale;
    };


    // Set scale for vertex and extension dashed line
    proto.setScale = function(point) {

        var pixelSize = 5;

        var navapi = this.viewer.navigation;
        var camera = navapi.getCamera();
        var position = navapi.getPosition();

        var p = point.clone();

        var distance = camera.isPerspective ? p.sub(position).length()
            : navapi.getEyeVector().length();

        var fov = navapi.getVerticalFov();
        var worldHeight = 2.0 * distance * Math.tan(THREE.Math.degToRad(fov * 0.5));

        var viewport = navapi.getScreenViewport();
        var scale = pixelSize * worldHeight / viewport.height;

        return scale;
    };

    proto.alignLabelWithLine = function(label, p1, p2, offset, viewer){
        var camUpVector = viewer.navigation.getCameraUpVector();
        var worldUpVec = new THREE.Vector3(0,1,0);
        var cameraAngle = worldUpVec.angleTo(camUpVector) * 180 / Math.PI;

        cameraAngle = camUpVector.x >= 0 ? cameraAngle : -cameraAngle;
        
        var angle = null;

        var deltaX = p1.x - p2.x;
        var deltaY = p1.y - p2.y;

        if (p1.x < p2.x) {
            angle =  Math.atan2(-deltaY , -deltaX) * 180 / Math.PI;    
        } 
        else {
            angle =  Math.atan2(deltaY , deltaX) * 180 / Math.PI;    
        }

        angle = -(angle + cameraAngle);

        if (Math.abs(angle) > 90){
            angle = angle + 180;
        }

        label.style.transform = 'rotate('+ angle +'deg) translate(0px, ' + offset + 'px)';
    };

    proto.destroy = function() {
        this.materialPoint = null;
        this.materialFace = null;
        this.materialLine = null;
        this.materialAngle = null;

        if (av.isTouchDevice()) {
            this.clearLabelMobileGestures();    
        }

        for (var name in this.endpoints) {
            if (this.endpoints.hasOwnProperty(name)) {
                var endPoint = this.endpoints[name];

                if (endPoint.label) {
                    endPoint.label.removeEventListener(av.isSafari() ? 'mousedown' : 'pointerdown', this.onMouseClickBinded);
                    endPoint.label.removeEventListener('mousewheel', this.viewer.toolController.mousewheel);
                    endPoint.label.parentNode.removeChild(endPoint.label);
                    endPoint.label = null;
                }
            }
        }

        this.visibleLabels = [];
    };

    proto.renderRubberbandFromPoints = function(points) {
        switch (this.measurement.measurementType) {
            case MeasureCommon.MeasurementTypes.MEASUREMENT_DISTANCE:
                var start = points[1];
                var end = points[2];
                
                if (start && end) {
                    this.renderDistanceMeasurementFromPoints(start, end);
                }
                break;

            case MeasureCommon.MeasurementTypes.MEASUREMENT_ANGLE:
                this.renderAngleMeasurementFromPoints(points);
                break;

            case MeasureCommon.MeasurementTypes.MEASUREMENT_AREA:
                this.renderAreaMeasurementFromPoints(points);
                break;
        }

    }

    proto.renderRubberband = function(picks) {

        switch (this.measurement.measurementType) {
            case MeasureCommon.MeasurementTypes.MEASUREMENT_DISTANCE:
                var previewsPick = picks[1];
                var activePick = picks[2];
                var start = MeasureCommon.getSnapResultPosition(previewsPick, this.viewer);
                var end = MeasureCommon.getSnapResultPosition(activePick, this.viewer);
                
                if (start && end) {
                    this.renderDistanceMeasurement(start, end);
                }
                break;

            case MeasureCommon.MeasurementTypes.MEASUREMENT_ANGLE:
                this.renderAngleMeasurement(picks);
                break;

            case MeasureCommon.MeasurementTypes.MEASUREMENT_AREA:
                this.renderAreaMeasurement(picks);
                break;
        }
    };

    proto.initMouseEvent = function(label, pointNumber) {
        
        var isSafari = av.isSafari();
        this.onMouseClickBinded = function(event) { 
            if(isSafari || event.pointerType === 'mouse'){
                event.canvasX = event.clientX;
                event.canvasY = event.clientY;
                this.tool.editEndpoint(event, pointNumber, this.measurement.id); 
            }
        }.bind(this);
        label.addEventListener(isSafari ? 'mousedown' : 'pointerdown', this.onMouseClickBinded);         
    };
