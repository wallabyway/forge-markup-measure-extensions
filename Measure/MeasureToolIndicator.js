import { Indicator } from './Indicator'
import { getPolygonVisualCenter } from "./PolygonCentroid";

    var av = Autodesk.Viewing;
    var MeasureCommon = Autodesk.Viewing.MeasureCommon;


    // /** @constructor */
    export function MeasureToolIndicator( viewer, measurement, measureTool )
    {
        Indicator.call(this, viewer, measurement, measureTool);
        this.measureTool = measureTool;
        this.endpoints = [];
        this.lines = { 
            xyz: {axis: false, material: createLineMaterial('005BCE'), className: 'adsk-icon-axis-delta' + '-xyz measure-label-axis-delta' + ' measure-label-axis-xyz'},
            x:   {axis: true,  material: createLineMaterial('F12C2C'), className: 'adsk-icon-axis-delta' + '-x measure-label-axis-delta' + ' measure-label-axis-x', iconText: 'X'},
            y:   {axis: true,  material: createLineMaterial('0BB80B'), className: 'adsk-icon-axis-delta' + '-y measure-label-axis-delta' + ' measure-label-axis-y', iconText: 'Y'},
            z:   {axis: true,  material: createLineMaterial('2C2CF1'), className: 'adsk-icon-axis-delta' + '-z measure-label-axis-delta' + ' measure-label-axis-z', iconText: 'Z'}
        };
        this.segments = [];
        this.dashedLine = {};
        this.simple = false;
        this.angleLabel = {};
        this.areaLabel = {};
        this.labels = [];
        this.isLeaflet = false;
        this.topologyStatus = TOPOLOGY_NOT_AVAILABLE;
        this.tmpVector = new THREE.Vector3();
        this.surfaceColor = new THREE.MeshBasicMaterial({
            color: parseInt('005BCE', 16),
            opacity: 0.15,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });   
    }

    MeasureToolIndicator.prototype = Object.create(Indicator.prototype);
    MeasureToolIndicator.prototype.constructor = MeasureToolIndicator;
    var proto = MeasureToolIndicator.prototype;

    function createLineMaterial(color) {
        return new THREE.MeshBasicMaterial({
            color: parseInt(color, 16),
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });   
    }

    var _labelsSpace = 4;
    var _angleLabelOffset = 5;
    var TOPOLOGY_NOT_AVAILABLE = 0;
    var TOPOLOGY_FETCHING = 1; 
    var TOPOLOGY_AVAILABLE = 2;
    var _selectorAreaSize = 15;

    var _tipHeight = 2;
    var _tipWidth = 3;
    var _segmentWidth = 4;
    var _dashedSegmentWidth = 3;
    var _axisLineWidth = 2;
    var _dashSize = 2;
    var _gapSize = 1;

    var _angleArcWidth = 2;

    function isVisible(label) {
        return label.classList.contains('visible');
    }

    proto.init = function() {
        this.isLeaflet = this.viewer.model.getData().isLeaflet;
        // Create HTML Labels
        var currLabel;

        this.onSelectionAreaClickedBinded = this.onSelectionAreaClicked.bind(this);

        // Line
        if (!this.lines.xyz.label) {
            currLabel = this.lines.xyz.label = this.createMeasurementLabel(); // Measurement result
            currLabel.addEventListener('mousewheel', this.viewer.toolController.mousewheel);
            currLabel.addEventListener('click', this.onSelectionAreaClickedBinded);
            this.viewer.container.appendChild(currLabel);
        }
        switch (this.topologyStatus) {
            case TOPOLOGY_FETCHING:
                this.setFetchingTopology();
                break;
            case TOPOLOGY_AVAILABLE:
                this.setTopologyAvailable();
                break;
            case TOPOLOGY_NOT_AVAILABLE:
                this.setNoTopology();
                break;
        }

        this.showMeasureResult = false;

        this.onCameraChangeBinded = this.onCameraChange.bind(this);
        this.viewer.addEventListener(av.CAMERA_CHANGE_EVENT, this.onCameraChangeBinded);

        this.handleButtonUpBinded = this.measureTool.handleButtonUp.bind(this.measureTool);
        this.addWindowEventListener('mouseup', this.handleButtonUpBinded);
    };

    proto.createEndpoint = function(index) {
        this.endpoints[index] = {};
        var currLabel = this.endpoints[index].label = this.createSnapResultLabel(index);
        this.viewer.container.appendChild(currLabel);    
    };

    proto.updateLabelsPosition = function() {

        var point,
            xy,
            label,
            key;


        for (key in this.endpoints) {
            if (this.endpoints.hasOwnProperty(key)) {
                    label = this.endpoints[key].label;
                    point = this.endpoints[key].position;

                if (label && point && isVisible(label)) {
                    xy = MeasureCommon.project(point, this.viewer);

                    xy.x = xy.x - label.getBoundingClientRect().width / 2;
                    xy.y = xy.y - label.getBoundingClientRect().height / 2;
                    
                    label.style.top  = xy.y + 'px';
                    label.style.left = xy.x + 'px';
                    label.point = point;
                    this.labels.push(label);
                }
            }
        }

        for (var name in this.lines) {
            if (this.lines.hasOwnProperty(name)) {
                var item = this.lines[name];
                    label = item.label;

                if (label && item.p1 && item.p2 && isVisible(label)) {
                    
                    item.line.visible = item.visible;

                    point = { x: (item.p1.x + item.p2.x)/2, y: (item.p1.y + item.p2.y)/2, z: (item.p1.z + item.p2.z)/2 };
                    
                    xy = MeasureCommon.project(point, this.viewer);
                    label.style.top  = xy.y - Math.floor(label.clientHeight / 2) + 'px';
                    label.style.left = xy.x - Math.floor(label.clientWidth / 2) + 'px';

                    if (this.viewer.model && this.viewer.model.is2d()) {
                        var offset = item === this.lines.xyz ? 0 : label.clientHeight;

                        var p1Projected = MeasureCommon.project(item.p1, this.viewer);
                        var p2Projected = MeasureCommon.project(item.p2, this.viewer);

                        if (label.clientWidth >= p1Projected.distanceTo(p2Projected) - this.endpoints[1].label.clientWidth) {
                            if (item === this.lines.xyz) {
                                offset = label.clientHeight;
                            } else {
                                // Hide all axis labels and quit the loop
                            
                                this.lines.x.line.visible = false;
                                this.lines.y.line.visible = false;

                                this.viewer.impl.invalidate(false, false, /*overlayDirty=*/true);

                                for (name in this.lines) {
                                    if (this.lines.hasOwnProperty(name)) {
                                        if (this.lines[name] !== this.lines.xyz) {
                                            var currLabel = this.lines[name].label;
                                            if (currLabel) {
                                                currLabel.style.opacity = 0;
                                            }
                                        }
                                    }
                                }

                                break;
                                
                            }
                        }

                        if (item !== this.lines.xyz) {
                            var xyzDirection = new THREE.Vector3();
                            var itemDirection = new THREE.Vector3();
                            xyzDirection.subVectors(this.lines.xyz.p1, this.lines.xyz.p2).normalize();
                            itemDirection.subVectors(item.p1, item.p2).normalize();
                            var normal = xyzDirection.cross(this.viewer.navigation.getEyeVector()).normalize();
                            var angle = normal.dot(itemDirection);
                            
                            if (angle < 0) {
                                offset = -offset;
                            }
                        }

                        this.alignLabelWithLine(label, item.p1, item.p2, offset, this.viewer);
                    }

                    label.style.opacity = 1;
                    label.point = point;
                    this.labels.push(label);
                }
            }
        }

        if (this.angleLabel) {

            label = this.angleLabel.label;

            if (label && this.angleLabel.p1 && this.angleLabel.p2 && isVisible(label)) {
                point = { x: (this.angleLabel.p1.x + this.angleLabel.p2.x)/2, y: (this.angleLabel.p1.y + this.angleLabel.p2.y)/2, z: (this.angleLabel.p1.z + this.angleLabel.p2.z)/2 };
                xy = MeasureCommon.project(point, this.viewer, _angleLabelOffset);
                label.style.top = xy.y - Math.floor(label.clientHeight / 2) + 'px';
                label.style.left = xy.x - Math.floor(label.clientWidth / 2) + 'px';
                label.point = point;
                this.labels.push(label);
            }
        }

        if (this.areaLabel) {

            label = this.areaLabel.label;

            if (label && this.areaLabel.p1 && this.areaLabel.p2 && isVisible(label)) {
                point = { x: (this.areaLabel.p1.x + this.areaLabel.p2.x)/2, y: (this.areaLabel.p1.y + this.areaLabel.p2.y)/2, z: (this.areaLabel.p1.z + this.areaLabel.p2.z)/2 };
                xy = MeasureCommon.project(point, this.viewer);
                label.style.top  = xy.y - Math.floor(label.clientHeight / 2) + 'px';
                label.style.left = xy.x - Math.floor(label.clientWidth / 2) + 'px';
                label.point = point;
                this.labels.push(label);
            }
        }

        if (this.viewer.model && !this.viewer.model.is2d()) {
    
            var needToStackLabels = false;
            this.labelsStacked = false;
            var currentLabel, i;

            // Backup lable's positions in case of the need of stacking them later
            var backupPositions = [];
            for (i = 0; i < this.labels.length; i++) {
                backupPositions.push({left: this.labels[i].style.left, top:this.labels[i].style.top});
            }

            // Detect and move in case of overlapping.
            for (i = 0; i < this.labels.length && !needToStackLabels; i++) {
                currentLabel = this.labels[i];
                needToStackLabels = this.labelsOverlapDetection(currentLabel, this.labels);
            }

            // If we found out that the labels need to be stacked, restore their positions from the backup first, and then start again.
            if (needToStackLabels) {

                for (i = 0; i < this.labels.length; i++) {
                    this.labels[i].style.left = backupPositions[i].left;
                    this.labels[i].style.top = backupPositions[i].top;
                }

                this.stackLabels(this.labels);

                for (i = 0; i < this.labels.length; i++) {
                    currentLabel = this.labels[i];
                    this.labelsOverlapDetection(currentLabel, this.labels);
                }
            } 
        }

        this.labels = [];
        
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

        var needToStackLabels = false;

        for (var i = 0; i < labelsList.length ; i++) {

            var dynamicLabel = labelsList[i];
            var moved = false;

            if (staticLabel !== dynamicLabel) {
                var staticRect = staticLabel.getBoundingClientRect();
                var dynamicRect = dynamicLabel.getBoundingClientRect();

                if (isVerticalIntersect(dynamicRect, staticRect)) {

                    if (isLeftIntersect(dynamicRect, staticRect)) {
                        moveLeft(dynamicLabel, dynamicRect, staticRect);
                        moved = true;
                    }
                    else if (isRightIntersect(dynamicRect, staticRect)) {
                        moveRight(dynamicLabel, dynamicRect, staticRect);
                        moved = true;
                    }
                    else if (isMiddleIntersect(dynamicRect, staticRect)) {
                        moveDown(dynamicLabel, dynamicRect, staticRect);
                        moved = true;
                    }

                    if (moved) {
                        var newList = labelsList.slice(0);
                        newList.splice(newList.indexOf(staticLabel), 1);
                        this.labelsOverlapDetection(dynamicLabel, newList);    
                        
                        if (dynamicLabel.causeStacking && staticLabel.causeStacking) {
                            needToStackLabels = true;
                        }

                        // We don't want that after the labels have been stacked, only one of them will move alone.
                        if (dynamicLabel.causeStacking && this.labelsStacked) {
                            this.stackLabels(this.labels);
                        }
                    }
                }
            }
        }

        return needToStackLabels;
    };

    proto.stackLabels = function(labels) { 
        var topLabel = this.lines.xyz.label;

        for (var i = 1; i < labels.length; i++) {
            if (labels[i].causeStacking) {
                labels[i].style.left = topLabel.style.left;
            
                var rect = labels[i-1].getBoundingClientRect();
                var space = (labels[i-1] == topLabel) ? _labelsSpace : 0;
                var top = (labels[i] === topLabel) ? topLabel.style.top : labels[i-1].style.top;
                labels[i].style.top = parseInt(top, 10) + rect.height + space + 'px';
            }
            labels[i].style.transform = '';
        }

        this.labelsStacked = true;
    };

    proto.drawXYZLine = function(item) {
        var self = this;

        var p1 = item.p1;
        var p2 = item.p2;

        if (!p1 || !p2)
            return;

        var tmpVec = new THREE.Vector3();
        var geometry = item.geometry = new THREE.Geometry();
        var direction = new THREE.Vector3().subVectors(p2, p1).normalize();
        var normal = direction.clone().cross(self.viewer.navigation.getEyeVector()).normalize();
        var point = MeasureCommon.nearestPointInPointToSegment(self.viewer.navigation.getPosition(), p1, p2);
        var scale = self.setScale(point);

        item.line = this.drawLineSegment(p1, p2, _segmentWidth, item.material);
        item.visible = true;

        this.segments.push(item);
        
        function drawTip(p) {
            geometry.vertices = [];

            // Edge
            tmpVec.addVectors(p, normal.clone().multiplyScalar(_tipHeight * scale));
            geometry.vertices[0] = tmpVec.clone();
            tmpVec.subVectors(p, normal.clone().multiplyScalar(_tipHeight * scale));
            geometry.vertices[1] = tmpVec.clone();
            var line = self.drawLineAsCylinder(geometry, item.material, _tipWidth, self.overlayName);
            self.setCylinderScale(line, p1 ,p2);
            line.visible = true;
            item.tips.push(line);
        }

        if (self.showMeasureResult) {
            item.tips = [];

            drawTip(p1);
            drawTip(p2);    
        }        
    };

    proto.redrawDashedLine = function() {
        if (!this.dashedLine.p1 || !this.dashedLine.p2)
            return;

        this.viewer.impl.removeMultipleOverlays(this.overlayName, this.dashedLine.line);
        
        var p1Scale = this.setScale(this.dashedLine.p2);
        var dashSize = _dashSize * p1Scale;
        var gapSize = _gapSize * p1Scale;
        this.dashedLine.line = this.drawDashedLine(this.dashedLine.p2, this.dashedLine.p1, dashSize, gapSize, this.lines.xyz.material, _dashedSegmentWidth, this.overlayName);

        return this.dashedLine.line;
    }; 

    proto.drawLineSegment = function(p1, p2, width, material, isDashedLine) {
        var line;

        if (isDashedLine) {
            this.dashedLine.p1 = p1;
            this.dashedLine.p2 = p2;
            line = this.redrawDashedLine();
        } else {
            var geometry = new THREE.Geometry();
            geometry.vertices.push(p1);
            geometry.vertices.push(p2);
            line = this.drawLineAsCylinder(geometry, material, width, this.overlayName);
            this.setCylinderScale(line, p1, p2);
        }

        line.visible = true;

        return line;
    };

    proto.drawSurface = function(points) {

        const cg = Autodesk.Viewing.Extensions.CompGeom;

        let cset = new cg.ContourSet();

        cset.addContour(points);

        cset.triangulate();

        if (cset.triangulationFailed)
            return false;

        let bufferGeometry = cset.toPolygonMesh();

        var face = new THREE.Mesh(bufferGeometry, this.surfaceColor);

        this.viewer.impl.addOverlay(this.overlayName, face);

        return true;
    };

    proto.drawSegmentAndPush = function(p1, p2, isDashedLine) {
        if (!p1 || !p2) {
            return;
        }

         var line = this.drawLineSegment(p1, p2, _segmentWidth, this.lines.xyz.material, isDashedLine);
            
        if (!isDashedLine) {
            var item = { line: line, p1: p1, p2: p2 };
            this.segments.push(item);    
        }
    };

    proto.renderAreaMeasurement = function(picks) {

        var count = this.measurement.countPicks();
        var p1, p2;

        var points = [];
        
        for (var i = 1; i < count; i++) {
            p1 = MeasureCommon.getSnapResultPosition(picks[i], this.viewer);
            p2 = MeasureCommon.getSnapResultPosition(picks[i + 1], this.viewer);

            this.drawSegmentAndPush(p1, p2);
            points.push(p1);
        }

        if (count > 2) {
            // Draw last line
            p1 = MeasureCommon.getSnapResultPosition(picks[1], this.viewer);
            this.drawSegmentAndPush(p1, p2, !this.measurement.closedArea);
            
            if(!MeasureCommon.isEqualVectors(p1,p2,MeasureCommon.EPSILON)){
                points.push(p2);
            }
            
            if (this.measurement.area !== 0) {
                //Draw surface will return false if it failed to triangulate the polygon (e.g. it has self-intersections)
                if (this.drawSurface(points)) {
                    this.showAreaLabel(getPolygonVisualCenter(points));
                    this.updateArea();
                }
            }
        }        
    };

    proto.clearAngleMeshes = function() {
        if (this.angleArc) {
            this.viewer.impl.removeOverlay(this.overlayName, this.angleArc);
            this.angleArc = null;
        }
        if (this.angleOutline.length > 0) {
            this.viewer.impl.removeMultipleOverlays(this.overlayName, this.angleOutline);
            this.angleOutline.length = 0;
        }
    };

    proto.drawAngle = function(p, ep1, ep2, n, angle, midPoint) {

        var smallNum = 0.001;

        if (!this.materialAngle) {

            this.materialAngle = new THREE.MeshPhongMaterial({
                    color: 0x999999,
                    ambient: 0x999999,
                    opacity: 0.5,
                    transparent: true,
                    depthTest: false,
                    depthWrite: false,
                    side: THREE.DoubleSide
                }
            );

            this.materialAngleOutline = new THREE.MeshBasicMaterial({
                color: 0xFF9900,
                depthTest: false,
                depthWrite: false
            });

        }

        MeasureCommon.createCommonOverlay(this.viewer, this.overlayName);
        this.clearAngleMeshes();

        // draw arc of angle
        var radius = Math.min(p.distanceTo(ep1), p.distanceTo(ep2)) / 4;
        var segments = 100;
        //angle = angle * Math.PI / 180;

        var circleGeometry = new THREE.CircleGeometry(radius, segments, 0, angle * Math.PI / 180);
        var arc = new THREE.Mesh(circleGeometry, this.surfaceColor);

        var center = arc.geometry.vertices[0].clone();
        arc.geometry.vertices.push(center);


        // Translate and rotate the arc to the plane where it should lie in
        arc.position.set(p.x, p.y, p.z);
        var V = arc.position.clone();
        V.add(n);
        arc.lookAt(V);
        arc.updateMatrixWorld();


        // Rotate the arc in the plane to the right place
        var vA = arc.geometry.vertices[1].clone();
        var vB = arc.geometry.vertices[arc.geometry.vertices.length - 2].clone();
        vA.applyMatrix4(arc.matrixWorld);
        vB.applyMatrix4(arc.matrixWorld);

        var v1 = new THREE.Vector3();
        var v2 = new THREE.Vector3();
        var v3 = new THREE.Vector3();
        var v4 = new THREE.Vector3();
        v1.subVectors(vA, p);
        v2.subVectors(vB, p);
        v3.subVectors(ep1, p);
        v4.subVectors(ep2, p);

        var a13 = v1.angleTo(v3);
        var a14 = v1.angleTo(v4);
        var a23 = v2.angleTo(v3);
        var a24 = v2.angleTo(v4);

        //console.log(a13 * 180 / Math.PI + " " + a14 * 180 / Math.PI + " " + a23 * 180 / Math.PI + " " + a24 * 180 / Math.PI);

        var ra;
        // The arc is in the right place
        if (((a13 <= smallNum && a13 >= -smallNum) || (a14 <= smallNum && a14 >= -smallNum))
            && ((a23 <= smallNum && a23 >= -smallNum) || (a24 <= smallNum && a24 >= -smallNum))) {

            ra =0;
        }
        // The arc needs to be rotated 180 degree to the right place
        else if (((a13 <= Math.PI + smallNum && a13 >= Math.PI - smallNum) || (a14 <= Math.PI + smallNum && a14 >= Math.PI - smallNum))
            && ((a23 <= Math.PI + smallNum && a23 >= Math.PI - smallNum) || (a24 <= Math.PI + smallNum && a24 >= Math.PI - smallNum))) {

            ra = Math.PI;
        }
        // The arc needs to be rotated a13 radian
        else if ((a13 <= a23 + smallNum && a13 >= a23 - smallNum) || (a13 <= a24 + smallNum && a13 >= a24 - smallNum)) {

            ra = a13;
        }
        // The arc needs to be rotated a14 radian
        else {

            ra = a14;
        }

        var rotWorldMatrix = new THREE.Matrix4();
        rotWorldMatrix.makeRotationAxis(n, ra);
        //arc.matrix.multiply(rotWorldMatrix);
        rotWorldMatrix.multiply(arc.matrix);
        arc.matrix = rotWorldMatrix;
        arc.rotation.setFromRotationMatrix(arc.matrix);

        // Check if rotate to the wrong direction, if so, rotate back twice of the degree
        arc.updateMatrixWorld();
        vA = arc.geometry.vertices[1].clone();
        vB = arc.geometry.vertices[arc.geometry.vertices.length - 2].clone();
        vA.applyMatrix4(arc.matrixWorld);
        vB.applyMatrix4(arc.matrixWorld);

        v1.subVectors(vA, p);
        v2.subVectors(vB, p);

        a13 = v1.angleTo(v3);
        a14 = v1.angleTo(v4);
        a23 = v2.angleTo(v3);
        a24 = v2.angleTo(v4);

        //console.log(a13 * 180 / Math.PI + " " + a14 * 180 / Math.PI + " " + a23 * 180 / Math.PI + " " + a24 * 180 / Math.PI);

        if (a13 >= smallNum && a14 >= smallNum) {

            rotWorldMatrix = new THREE.Matrix4();
            rotWorldMatrix.makeRotationAxis(n, - ra * 2);
            //arc.matrix.multiply(rotWorldMatrix);
            rotWorldMatrix.multiply(arc.matrix);
            arc.matrix = rotWorldMatrix;
            arc.rotation.setFromRotationMatrix(arc.matrix);
        }

        // draw outline of the arc
        var outlineGeometry = new THREE.CircleGeometry(radius, segments, 0, angle * Math.PI / 180);
        outlineGeometry.vertices.splice(0, 1);
        arc.updateMatrixWorld();
        outlineGeometry.applyMatrix(arc.matrixWorld);
        this.angleOutline = this.drawEdgeAsCylinder(outlineGeometry, this.lines.xyz.material, _angleArcWidth, 0, this.getNewCylinderGeometry());

        this.angleArc = arc;
        this.viewer.impl.addOverlay(this.overlayName, this.angleArc);
        this.viewer.impl.addMultipleOverlays(this.overlayName, this.angleOutline);

        // This is used for angle label's position
        midPoint.copy(arc.geometry.vertices[Math.round(arc.geometry.vertices.length / 2) - 1]);
        midPoint.applyMatrix4(arc.matrixWorld);
        var dir = new THREE.Vector3();
        dir.subVectors(midPoint, p).normalize();
        dir.multiplyScalar(radius / 2);
        midPoint.add(dir);
    };

    proto.renderAngleMeasurement = function(picks) {

        var count = this.measurement.countPicks();
        var p1, p2;

        var points = [];
        
        for (var i = 1; i < count; i++) {
            p1 = MeasureCommon.getSnapResultPosition(picks[i], this.viewer);
            p2 = MeasureCommon.getSnapResultPosition(picks[i + 1], this.viewer);

            this.drawSegmentAndPush(p1, p2);

            if (p1) {
                points.push(p1);    
            }
        }

        if (p2) {
            points.push(p2);
        }
        
        if (points.length === 3 && this.measurement.angle) {
            var n = new THREE.Vector3();
            var v1 = new THREE.Vector3();
            var v2 = new THREE.Vector3();
            v1.subVectors(points[0], points[1]);
            v2.subVectors(points[1], points[2]);
            n.crossVectors(v1, v2);
            n.normalize();

            var midPoint = new THREE.Vector3();
            this.drawAngle(points[1], points[0], points[2], n, this.measurement.angle, midPoint);
            this.showAngleLabel(midPoint);
            this.updateAngle();
        }        
    };

    proto.createDistanceLabel = function(item) {
        var label = item.label = this.createMeasurementLabel();
        
        setVisibilityMeasurementLabelText(label, item === this.lines.xyz);

        const _document = this.getDocument();
        // Override main label when displaying only an axis label (X, Y or Z)
        if (item.axis) {
            label.className = item.className;
            var axisIcon = _document.createElement('div');
            axisIcon.className = 'measure-label-axis-icon ' + item.iconText;
            axisIcon.innerText = item.iconText;
            label.insertBefore(axisIcon, label.firstChild);

            if (!av.isMobileDevice()) {
                MeasureCommon.safeToggle(label, 'enableTransition', true);
            }
        }

        this.viewer.container.appendChild(label);

        return label;
    };

    // Draw distance measurement
    proto.renderDistanceMeasurement = function(p1, p2)
    {
        var self = this;

        function updateLine(item, x1, y1, z1, x2, y2, z2, showAxis) {
            var line = item.line,
                label = item.label,
                p1 = new THREE.Vector3(x1, y1, z1),
                p2 = new THREE.Vector3(x2, y2, z2);

            // Swap points if needed to have consistent axis directions.
            var tmpVec;
            if (item === self.lines.x && p2.x > p1.x) {
                tmpVec = p1.clone();
                p1 = p2.clone();
                p2 = tmpVec.clone();
            } 
            else if (item === self.lines.y && p2.y > p1.y) {
                tmpVec = p1.clone();
                p1 = p2.clone();
                p2 = tmpVec.clone();
            } 
            else if (item === self.lines.z && p2.z > p1.z) {
                tmpVec = p1.clone();
                p1 = p2.clone();
                p2 = tmpVec.clone();
            }

            item.line = null;            

            if (!label) {
                label = self.createDistanceLabel(item);
            }
            else {
                self.hideLabel(label);
            }
            
            if (((self.isLeaflet && item !== self.lines.z) || (p1.distanceTo(p2) >= MeasureCommon.EPSILON)) && showAxis) {

                item.p1 = p1;
                item.p2 = p2;

                if (item === self.lines.xyz) {
                    self.drawXYZLine(item);
                    self.showLabel(label);
                    self.updateDistance();
                }
                else {
                    line = item.line = self.drawLineSegment(p1, p2, _axisLineWidth, item.material);
                    var show = !self.simple && self.showMeasureResult;

                    line.visible = show;
                    item.visible = show;

                    if (show) {
                        self.showLabel(label);
                    }
                    else {
                        self.hideLabel(label);
                    }
                }
            }
        }

        // If the line aligns with one of axis, then don't show axis
        function displayAxis(p1, p2) {
            self.tmpVector.subVectors(p1, p2);
            self.tmpVector.normalize();

            return !MeasureCommon.isParallel(self.tmpVector, self.xAxis) && !MeasureCommon.isParallel(self.tmpVector, self.yAxis) && !MeasureCommon.isParallel(self.tmpVector, self.zAxis);
        }

        updateLine(this.lines.xyz, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, true);

        var up = this.viewer.navigation.getAlignedUpVector(),
            x = Math.abs(up.x),
            y = Math.abs(up.y),
            z = Math.abs(up.z);

        var showAxis = displayAxis(p1, p2);

        if (z > x && z > y) { // z up
            updateLine(this.lines.x, p1.x, p1.y, p1.z, p2.x, p1.y, p1.z, showAxis);
            updateLine(this.lines.y, p2.x, p1.y, p1.z, p2.x, p2.y, p1.z, showAxis);
            updateLine(this.lines.z, p2.x, p2.y, p1.z, p2.x, p2.y, p2.z, showAxis);

        } else if (y > x && y > z) { // y up
            updateLine(this.lines.x, p1.x, p1.y, p1.z, p2.x, p1.y, p1.z, showAxis);
            updateLine(this.lines.z, p2.x, p1.y, p1.z, p2.x, p1.y, p2.z, showAxis);
            updateLine(this.lines.y, p2.x, p1.y, p2.z, p2.x, p2.y, p2.z, showAxis);

        } else { // x up - do we ever see this?
            updateLine(this.lines.y, p1.x, p1.y, p1.z, p1.x, p2.y, p1.z, showAxis);
            updateLine(this.lines.z, p1.x, p2.y, p1.z, p1.x, p2.y, p2.z, showAxis);
            updateLine(this.lines.x, p1.x, p2.y, p2.z, p2.x, p2.y, p2.z, showAxis);
        }

    };

    proto.updateResults = function() {
        this.updateDistance();
        this.updateAngle();
        this.updateArea();
        
        setTimeout(function(){
            // This can get called after the viewer is unloaded
            if (this.viewer.impl)
                this.updateLabelsPosition();
        }.bind(this), 0);
    };

    // Update distance measurement label
    proto.updateDistance = function() {

        function setWidth(label, value) {
            if (!label) return;
            label.style.width = value;
        }

        function getWidth(label) {
            return label ? label.clientWidth : 0;
        }

        Object.keys(this.lines).forEach(function(name) {
            setWidth(this.lines[name].label, '');
        }.bind(this));
        
        setDeltaMeasurementLabelText(this.lines.x.label, "~ " + this.measureTool.getDistanceX(this.measurement));
        setDeltaMeasurementLabelText(this.lines.y.label, "~ " + this.measureTool.getDistanceY(this.measurement));
        setDeltaMeasurementLabelText(this.lines.z.label, "~ " + this.measureTool.getDistanceZ(this.measurement));
        setValueMeasurementLabelText(this.lines.xyz.label, "~ " + this.measureTool.getDistanceXYZ(this.measurement));

        if (this.viewer.model && this.viewer.model.is3d()) {
            setTimeout(function(){
                var maxWidth = Math.max(getWidth(this.lines.x.label), getWidth(this.lines.y.label), getWidth(this.lines.z.label), getWidth(this.lines.xyz.label));                
                Object.keys(this.lines).forEach(function(name) {
                    setWidth(this.lines[name].label, maxWidth + 'px');
                }.bind(this));
            }.bind(this), 0);
        }
    };

    // Update angle measurement label
    proto.updateAngle = function() {
        setValueMeasurementLabelText(this.angleLabel.label, "~ " + this.measureTool.getAngle(this.measurement));
    };

    // Update area measurement label
    proto.updateArea = function() {
        setValueMeasurementLabelText(this.areaLabel.label, "~ " + this.measureTool.getArea(this.measurement));
    };

    // Set if collapse or expand the xyz delta distance
    proto.setSimple = function(simple) {
        if (this.simple != simple) {
            this.simple = simple;

            var isVisible = !simple;
            this.setLineVisible(this.lines.x, isVisible);
            this.setLineVisible(this.lines.y, isVisible);
            this.setLineVisible(this.lines.z, isVisible);

            this.updateLabelsPosition();

            this.viewer.impl.invalidate(false, false, /*overlayDirty=*/true);
        }
    };

    proto.setLineVisible = function(item, isVisible) {
        if (item.line) {
            item.line.visible = isVisible;
            item.visible = isVisible;

            if (item.label) {
                if (isVisible) {
                    this.showLabel(item.label);
                }
                else {
                    this.hideLabel(item.label);
                    item.label.style.opacity = 0;
                }
            }
        }
    };

    proto.enableLabelsTouchEvents = function(enable) {
        var value = enable ? 'all' : 'none';

        if (this.lines.xyz.label) {
            this.lines.xyz.label.style.pointerEvents = value;   
        }

        if (this.angleLabel.label) {
            this.angleLabel.label.style.pointerEvents = value;   
        }

        if (this.areaLabel.label) {
            this.areaLabel.label.style.pointerEvents = value;
        }
    };

    proto.setLabelsZIndex = function(zIndex) {
        for (var name in this.lines) {
            if (this.lines.hasOwnProperty(name)) {
                var item = this.lines[name];
                if (item.label) {
                    item.label.style.zIndex = zIndex;
                }
            }
        }

        if (this.angleLabel && this.angleLabel.label) {
            this.angleLabel.label.style.zIndex = zIndex;    
        }

        if (this.areaLabel && this.areaLabel.label) {
            this.areaLabel.label.style.zIndex = zIndex;    
        }

        for (name in this.endpoints) {
            if (this.endpoints.hasOwnProperty(name)) {
                var endpoint = this.endpoints[name];
                if (endpoint.label) {
                    endpoint.label.style.zIndex = zIndex - 1;
                }
            }
        }
    };

    proto.focusLabels = function() {
        this.setLabelsZIndex(3);
    };

    proto.unfocusLabels = function() {
        this.setLabelsZIndex(2);
    };

    proto.clear = function() {
        var name;

        for (name in this.endpoints) {
            if (this.endpoints.hasOwnProperty(name)) {
                var endpoint = this.endpoints[name];
                if (endpoint.label) {
                    this.hideLabel(endpoint.label);
                }
            }
        }

        for (name in this.lines) {
            if (this.lines.hasOwnProperty(name)) {
                var item = this.lines[name];
                if (item.line) {
                    item.line.visible = false;
                    item.visible = false;

                    item.tips && item.tips.forEach(function(tip) {
                        tip.visible = false;
                    });
                }
                if (item.label) {
                    this.hideLabel(item.label);
                    item.label.style.opacity = 0;
                    item.label.style.zIndex = 2;
                }
            }
        }

        if (this.angleLabel && this.angleLabel.label) {
            this.hideLabel(this.angleLabel.label);
        }

        if (this.areaLabel && this.areaLabel.label) {
            this.hideLabel(this.areaLabel.label);
        }
        
        this.clearSelectionAreas();

        this.segments = [];
        this.dashedLine = {};

        this.viewer.impl.clearOverlay(this.overlayName);
        MeasureCommon.createCommonOverlay(this.viewer, this.overlayName);
    };

    proto.hideClick = function(pickNumber) {

        Indicator.prototype.hideClick.call(this, pickNumber);

        for (var name in this.lines) {
            if (this.lines.hasOwnProperty(name)) {
                var item = this.lines[name];
                if (item.line) {
                    item.line.visible = false;
                    item.visible = false;

                    item.tips && item.tips.forEach(function(tip) {
                        tip.visible = false;
                    });
                }
                if (item.label) {
                    this.hideLabel(item.label);
                    item.label.style.opacity = 0;
                }
            }
        }

        if (this.angleLabel && this.angleLabel.label) {
            this.hideLabel(this.angleLabel.label);
        }

        if (this.areaLabel && this.areaLabel.label) {
            this.hideLabel(this.areaLabel.label);
        }

        this.enableSelectionAreas(item.selectionArea, false);
    };

    proto.destroy = function() {
        var name;

        Indicator.prototype.destroy.call(this);

        for (name in this.lines) {
            if (this.lines.hasOwnProperty(name)) {
                var item = this.lines[name];
                if (item.line) {
                    this.viewer.impl.clearOverlay(self.overlayName);
                    item.material = item.line = item.geometry = null;
                }

                if (item.label) {
                    if (name === 'xyz') {
                        item.label.addEventListener('mousewheel', this.viewer.toolController.mousewheel);
                        item.label.removeEventListener('click', this.onSelectionAreaClickedBinded);    
                    }

                    item.label.parentNode.removeChild(item.label);
                    item.label = null;
                }
                item.material = item.line = item.geometry = item.label = item.p1 = item.p2 = null;
            }
        }

        this.clearAngleMeshes();
        
        if (this.angleLabel && this.angleLabel.label) {
            this.angleLabel.label.parentNode.removeChild(this.angleLabel.label);
            this.angleLabel.label.removeEventListener('mousewheel', this.viewer.toolController.mousewheel);
            this.angleLabel.label.removeEventListener('click', this.onSelectionAreaClickedBinded);
             this.angleLabel.label = this.angleLabel.p1 = this.angleLabel.p2 = null;
        }

        

        if (this.areaLabel && this.areaLabel.label) {
            this.areaLabel.label.parentNode.removeChild(this.areaLabel.label);
            this.areaLabel.label.removeEventListener('mousewheel', this.viewer.toolController.mousewheel);
            this.areaLabel.label.removeEventListener('click', this.onSelectionAreaClickedBinded);
            this.areaLabel.label = this.areaLabel.p1 = this.areaLabel.p2 = null;
        }
        
        

        if (this.viewer.impl.overlayScenes[this.overlayName]){
            this.viewer.impl.removeOverlayScene(this.overlayName);
        }

        this.viewer.removeEventListener(av.CAMERA_CHANGE_EVENT, this.onCameraChangeBinded);
        this.removeWindowEventListener('mouseup', this.handleButtonUpBinded);
    };

    proto.clearXYZLine = function() {
        this.viewer.impl.removeOverlay(this.overlayName, this.lines.xyz.line);

        this.lines.xyz.tips && this.lines.xyz.tips.forEach(function(tip) {
            this.viewer.impl.removeOverlay(this.overlayName, tip);
        }.bind(this));
    };

    // Update scale for vertex, edge, line and extension dash line
    proto.updateScale = function() {
        var name;

        this.angleOutline.forEach(cylinderMesh => this.setCylinderScale(cylinderMesh));

        for (name in this.lines) {
            if (this.lines.hasOwnProperty(name)) {
                var item = this.lines[name];
                if (item.line && item !== this.lines.xyz) {
                    this.setCylinderScale(item.line, item.p1, item.p2);
                }
            }
        }
        
        for (name in this.segments) {
            if (this.segments.hasOwnProperty(name)) {
                var segment = this.segments[name];
                if (segment.line) {
                    this.setCylinderScale(segment.line, segment.p1, segment.p2);
                } 
            }
        }
        
        if (this.measurement.measurementType === MeasureCommon.MeasurementTypes.MEASUREMENT_DISTANCE) {
            if (this.measurement.isComplete()) {
                this.clearXYZLine();
                this.drawXYZLine(this.lines.xyz);
            }
        }
    };

    proto.setNoTopology = function(){
        this.topologyStatus = TOPOLOGY_NOT_AVAILABLE;
        if (this.lines.xyz.label) {
            setVisibilityMeasurementLabelSpinner(this.lines.xyz.label, false, this.topologyStatus);
            this.lines.xyz.label.classList.remove('fetching-topology');
        }
    };
    proto.setFetchingTopology = function() {
        this.topologyStatus = TOPOLOGY_FETCHING;
        if (this.lines.xyz.label) {
            setVisibilityMeasurementLabelSpinner(this.lines.xyz.label, true, this.topologyStatus);
                this.lines.xyz.label.classList.add('fetching-topology');
        }
    };
    proto.setTopologyAvailable = function() {
        this.topologyStatus = TOPOLOGY_AVAILABLE;
        if (this.lines.xyz.label) {
            setVisibilityMeasurementLabelSpinner(this.lines.xyz.label, false, this.topologyStatus);
            this.lines.xyz.label.classList.remove('fetching-topology');
        }
    };

    proto.createMeasurementLabel = function() {
      
        const _document = this.getDocument();

        var label = _document.createElement('div');
        label.className = 'measure-length';
        
        var spinner = _document.createElement('div');
        spinner.className = 'measure-fetching-topology';
        spinner.style.display = 'none';
        label.appendChild(spinner);

        var text = _document.createElement('div');
        text.className = 'measure-length-text';
        label.appendChild(text);    

        var delta = _document.createElement('div');
        delta.className = 'measure-delta-text';
        label.appendChild(delta);

        label.causeStacking = true;
        
        if (!av.isMobileDevice()) {
            MeasureCommon.safeToggle(label, 'enable-hover', true);
        }

        return label;
    };

    // Receives an object created with createMeasurementLabel()
    function setVisibilityMeasurementLabelText(label, isVisible) {
        var div = label.querySelector('.measure-length-text');
        div && (div.style.display = isVisible ? '' : 'none');
    }

    // Receives an object created with createMeasurementLabel()
    function setValueMeasurementLabelText(label, strValue) {
        if (!label) return;
        var div = label.querySelector('.measure-length-text');
        div && (div.textContent = strValue);
    }

    // Receives an object created with createMeasurementLabel()
    function setDeltaMeasurementLabelText(label, strValue) {
        if (!label) return;
        var div = label.querySelector('.measure-delta-text');
        div && (div.textContent = strValue);
    }

    // Receives an object created with createMeasurementLabel()
    function setVisibilityMeasurementLabelSpinner(label, isVisible, topologyStatus) {
        if (!label) return;
        var div = label.querySelector('.measure-fetching-topology');
        div && (div.style.display = 
            (isVisible && topologyStatus === TOPOLOGY_FETCHING) ? 'inline-block' : 'none');
    }

    /**
     * Helper function that creates the label used for (1) and (2),
     * which are the 2 mouse clicks for the measurement.
     */
    proto.createSnapResultLabel = function(pointNumber) {
        const _document = this.getDocument();

        var label = _document.createElement('div');
        label.className = 'measure-label';

        var label_icon = _document.createElement('div');
        label_icon.className = 'measure-label-icon';
        label.appendChild(label_icon);

        if (av.isTouchDevice()) {
            this.initLabelMobileGestures(label, pointNumber, this.measureTool);
            var hitArea = _document.createElement('div');
            hitArea.className = 'measure-label-hit-area';
            label.appendChild(hitArea);                      
        } 
         
        if (!av.isMobileDevice()) {
            this.initMouseEvent(label, pointNumber);

            label.addEventListener('mousewheel', this.viewer.toolController.mousewheel);
            MeasureCommon.safeToggle(label, 'enable-hover', true);  
        }
        
 
        label.causeStacking = false;
        
        return label;
    };

    proto.showAngleLabel = function(midPoint) {

            var label = this.angleLabel.label;

            if (!label) {
                label = this.angleLabel.label = this.createMeasurementLabel();
                this.viewer.container.appendChild(label);
                label.addEventListener('mousewheel', this.viewer.toolController.mousewheel);
                label.addEventListener('click', this.onSelectionAreaClickedBinded);
            }

            this.updateAngle();
            this.showLabel(label);

            this.angleLabel.p1 = midPoint.clone();
            this.angleLabel.p2 = midPoint.clone();

    };

    proto.showAreaLabel = function(midPoint) {

            var label = this.areaLabel.label;

            if (!label) {
                label = this.areaLabel.label = this.createMeasurementLabel();
                this.viewer.container.appendChild(label);
                label.addEventListener('mousewheel', this.viewer.toolController.mousewheel);
                label.addEventListener('click', this.onSelectionAreaClickedBinded);
            }

            this.updateArea();
            this.showLabel(label);

            this.areaLabel.p1 = midPoint;
            this.areaLabel.p2 = midPoint;

    };

    proto.onSelectionAreaClicked = function() {
        this.measureTool.selectMeasurementById(this.measurement.id);
    };

    proto.createSelectionArea = function() {
        const _document = this.getDocument();
        var selectionArea = _document.createElement('div');
        selectionArea.id = 'measurement-selection-area-' + this.measurement.id;
        this.viewer.container.appendChild(selectionArea);
        selectionArea.className = 'measure-selection-area';
        selectionArea.style.display = 'none';
        selectionArea.addEventListener('mousewheel', this.viewer.toolController.mousewheel);
        selectionArea.addEventListener('click', this.onSelectionAreaClickedBinded);
        return selectionArea;
    };

    proto.updateSelectionArea = function() {

        this.segments.forEach(function(item) 
        {
            if (item.p1 && item.p2) {
                var p1 = MeasureCommon.project(item.p1, this.viewer);
                var p2 = MeasureCommon.project(item.p2, this.viewer);

                if (!item.selectionArea) {
                    item.selectionArea = this.createSelectionArea();
                }

                var selectionArea = item.selectionArea;

                var v = new THREE.Vector2();

                selectionArea.style.top = (p1.y - (_selectorAreaSize / 2)) + 'px';
                selectionArea.style.left = p1.x  + 'px';
                selectionArea.style.width = v.subVectors(p1, p2).length() + 'px';
                selectionArea.style.height = _selectorAreaSize + 'px';

                var angle = null;
                var deltaX = p1.x - p2.x;
                var deltaY = p1.y - p2.y;

                angle =  Math.atan2(-deltaY , -deltaX) * 180 / Math.PI;    

                selectionArea.style.transform = 'rotate('+ angle +'deg)';
                selectionArea.style.transformOrigin = '0px ' + (_selectorAreaSize / 2) + 'px';
            }
        }.bind(this));

        if (this.measureTool.areAllPicksSet()) {
            this.enableSelectionAreas(true);    
        }
    };

    proto.clearSelectionAreas = function() {
        const _document = this.getDocument();
        this.segments.forEach(function(item) 
        {  
            if (item.selectionArea) {
                item.selectionArea.removeEventListener('mousewheel', this.viewer.toolController.mousewheel);
                item.selectionArea.removeEventListener('click', this.onSelectionAreaClickedBinded);
                var element = _document.getElementById('measurement-selection-area-' + this.measurement.id);
                if (element) {
                    element.parentNode.removeChild(element);
                }
                item.selectionArea = null;
            }
        }.bind(this));
    };

    proto.enableSelectionAreas = function(enable) {
        this.segments.forEach(function(item) 
        {   
            if (item.selectionArea) {
                if (enable) {
                    item.selectionArea.style.display = 'block';
                } 
                else {
                    item.selectionArea.style.display = 'none';
                }
            }
        }.bind(this));
    };

    proto.render = function(picks, showMeasureResult) {
        Indicator.prototype.render.call(this, picks, showMeasureResult);

        this.updateSelectionArea();
    };

    proto.onCameraChange = function() {
        this.redrawDashedLine();
        this.updateSelectionArea();
        this.hideLabelsOutsideOfView();
        this.updateLabelsPosition();
    };

    proto.handleResize = function() {
        this.redrawDashedLine();
        this.updateSelectionArea();
        this.updateLabelsPosition();
    };

