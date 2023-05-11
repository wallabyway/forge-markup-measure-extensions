import { Indicator } from './Indicator';
import { getPolygonVisualCenter } from "./PolygonCentroid";

    var av = Autodesk.Viewing;
    var MeasureCommon = Autodesk.Viewing.MeasureCommon;

    /** Color values should match Measure.css **/
    const DEFAULT_LINE_COLOR = '009bea';
    const X_AXIS_COLOR = "F12C2C";
    const Y_AXIS_COLOR = "0BB80B";
    const Z_AXIS_COLOR = "2C2CF1";
    /*******************************************/

    const tmpColor = new THREE.Color();
    function numToColor(num) {
        return tmpColor.set(num >>> 8).getHexString();
    }

    // /** @constructor */
    export function MeasureToolIndicator( viewer, measurement, measureTool )
    {
        Indicator.call(this, viewer, measurement, measureTool);
        this.measureTool = measureTool;
        this.endpoints = [];
        this.lines = { 
            xyz: {axis: false, material: this._createLineMaterial(DEFAULT_LINE_COLOR), className: 'adsk-icon-axis-delta' + '-xyz measure-label-axis-delta' + ' measure-label-axis-xyz'},
            x:   {axis: true,  material: this._createLineMaterial(X_AXIS_COLOR), className: 'adsk-icon-axis-delta' + '-x measure-label-axis-delta' + ' measure-label-axis-x', iconText: 'X'},
            y:   {axis: true,  material: this._createLineMaterial(Y_AXIS_COLOR), className: 'adsk-icon-axis-delta' + '-y measure-label-axis-delta' + ' measure-label-axis-y', iconText: 'Y'},
            z:   {axis: true,  material: this._createLineMaterial(Z_AXIS_COLOR), className: 'adsk-icon-axis-delta' + '-z measure-label-axis-delta' + ' measure-label-axis-z', iconText: 'Z'}
        };
        this.applyLineColor(this.lines.xyz.material);
        this.segments = [];
        this.dashedLines = [];
        this.simple = false;
        this.angleLabel = {};
        this.areaLabel = {};
        this.arcLabel = {};
        this.locationLabel = {};
        this.calloutLabel = {};
        this.labels = [];
        this.isLeaflet = false;
        this.topologyStatus = TOPOLOGY_NOT_AVAILABLE;
        this.tmpVector = new THREE.Vector3();
        this.surfaceColor = new THREE.MeshBasicMaterial({
            color: parseInt(DEFAULT_LINE_COLOR, 16),
            opacity: 0.15,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });   
        this.applyLineColor(this.surfaceColor);
    }

    MeasureToolIndicator.prototype = Object.create(Indicator.prototype);
    MeasureToolIndicator.prototype.constructor = MeasureToolIndicator;
    var proto = MeasureToolIndicator.prototype;

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
        this.isLeaflet = this.viewer.model.isLeaflet();
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

    proto._hexToCorrectedColor = function (color) {
        tmpColor.set(parseInt(color, 16));

        // In case of a 3D viewer, manually apply gamma correction to the materials.
        // It is needed because we are using THREE.js materials that don't get LMV's shaders.
        // So GAMMA_INPUT & GAMMA_OUTPUT are missing in their shaders.
        if (!this.viewer.impl.is2d) {
          tmpColor.multiply(tmpColor);
        }

        return tmpColor;
    };

    proto._createLineMaterial = function(color) {
        const correctedColor = this._hexToCorrectedColor(color);
        
        const material = new THREE.MeshBasicMaterial({
            color: correctedColor.getHex(),
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide,
        });

        return material;
    };

    proto.createEndpoint = function(index) {
        this.endpoints[index] = {};

        // Don't render endpoints that are under the labels.
        if (index === 2 &&
            (this.measurement.measurementType === MeasureCommon.MeasurementTypes.MEASUREMENT_LOCATION ||
                this.measurement.measurementType === MeasureCommon.MeasurementTypes.MEASUREMENT_CALLOUT)) {
            return;
        }

        var currLabel = this.endpoints[index].label = this.createSnapResultLabel(index);
        this.viewer.container.appendChild(currLabel);    
    };

    proto.applyLineColor = function(material) {
        if (!material)
            return;

        const hasColor = this.measurement.options && this.measurement.options.format &&
            this.measurement.options.format.TEXTCOLOR && this.measurement.options.format.TEXTCOLOR.Enabled === 'true' &&
            this.measurement.options.format.FILLCOLOR && this.measurement.options.format.FILLCOLOR.Enabled === 'true' &&
            this.measurement.options.format.LINECOLOR && this.measurement.options.format.LINECOLOR.Enabled === 'true';
        const lineColor = hasColor ? numToColor(this.measurement.options.format.LINECOLOR.UIntValue) : DEFAULT_LINE_COLOR;
        const correctedColor = this._hexToCorrectedColor(lineColor);

        material.color.set(correctedColor);
    };

    proto.applyLabelColors = function(label) {
        if (!label)
            return;

        const hasColor = this.measurement.options && this.measurement.options.format &&
            this.measurement.options.format.TEXTCOLOR && this.measurement.options.format.TEXTCOLOR.Enabled === 'true' &&
            this.measurement.options.format.FILLCOLOR && this.measurement.options.format.FILLCOLOR.Enabled === 'true' &&
            this.measurement.options.format.LINECOLOR && this.measurement.options.format.LINECOLOR.Enabled === 'true';
        const color = hasColor ? `#${numToColor(this.measurement.options.format.TEXTCOLOR.UIntValue)}` : `#${DEFAULT_LINE_COLOR}`;
        const bg = hasColor ? `#${numToColor(this.measurement.options.format.FILLCOLOR.UIntValue)}` : '#f4f4f4';
        label.style.color = color;
        label.style.backgroundColor = bg;
    };

proto.updateLabelsPosition = function() {

        var point,
            xy,
            label,
            key;

        const placeLabel = (xOff, yOff) => {
            xy = MeasureCommon.project(point, this.viewer);

            label.style.top  = (xy.y - yOff) + 'px';
            label.style.left = (xy.x - xOff) + 'px';
            label.point = point;
            this.applyLabelColors(label);
            this.labels.push(label);
        };
    
        for (key in this.endpoints) {
            if (Object.prototype.hasOwnProperty.call(this.endpoints, key)) {
                    label = this.endpoints[key].label;
                    point = this.endpoints[key].position;

                if (label && point && isVisible(label)) {
                    xy = MeasureCommon.project(point, this.viewer);

                    placeLabel(label.getBoundingClientRect().width / 2,
                        label.getBoundingClientRect().height / 2);
                }
            }
        }

        for (var name in this.lines) {
            if (Object.prototype.hasOwnProperty.call(this.lines, name)) {
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
                                    if (Object.prototype.hasOwnProperty.call(this.lines, name)) {
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
                    this.applyLabelColors(label);
                    this.labels.push(label);
                }
            }
        }

        if (this.angleLabel) {

            label = this.angleLabel.label;

            if (label && this.angleLabel.p1 && this.angleLabel.p2 && isVisible(label)) {
                point = { x: (this.angleLabel.p1.x + this.angleLabel.p2.x)/2, y: (this.angleLabel.p1.y + this.angleLabel.p2.y)/2, z: (this.angleLabel.p1.z + this.angleLabel.p2.z)/2 };
                xy = MeasureCommon.project(point, this.viewer, _angleLabelOffset);
                placeLabel(Math.floor(label.clientWidth / 2), Math.floor(label.clientHeight / 2));
            }
        }

        if(this.arcLabel) {
            label = this.arcLabel.label;
            offset = 0;

            if (label && this.arcLabel.p1 && this.arcLabel.p2 && isVisible(label)) {
                point = { x: (this.arcLabel.p1.x + this.arcLabel.p2.x)/2, y: (this.arcLabel.p1.y + this.arcLabel.p2.y)/2, z: (this.arcLabel.p1.z + this.arcLabel.p2.z)/2 };
                xy = MeasureCommon.project(point, this.viewer, label.clientHeight);
                placeLabel(Math.floor(label.clientWidth / 2), Math.floor(label.clientHeight / 2));

                // Rotate the label
                let p1Projected = MeasureCommon.project(this.arcLabel.point1Relative, this.viewer);
                let p2Projected = MeasureCommon.project(this.arcLabel.point2Relative, this.viewer);

                if (label.clientWidth >= p1Projected.distanceTo(p2Projected) - this.endpoints[1].label.clientWidth) {
                    
                    // you need to project midpoint and the circle center here because the offset direction logic occurs in screen coordinates
                    var midPointProjected = MeasureCommon.project(this.arcLabel.midPointRelative, this.viewer);
                    var centerProjected = MeasureCommon.project(new THREE.Vector3(), this.viewer);

                    // Check if the midpoint position is above or below the center of the circle
                    // Based on this, offset the label up or down to ensure it is always outside the arc
                    if(midPointProjected.y > centerProjected.y) {
                        offset = label.clientHeight; // offset down
                    } else {
                        offset = -label.clientHeight; // offset up
                    }

                }
                this.alignLabelWithLine(label, this.arcLabel.point1Relative, this.arcLabel.point2Relative, offset, this.viewer);
            }
        }

        if (this.locationLabel) {

            label = this.locationLabel.label;

            if (label && this.locationLabel.p && isVisible(label)) {
                xy = MeasureCommon.project(this.locationLabel.p, this.viewer);
                placeLabel(Math.floor(label.clientWidth / 2),Math.floor(label.clientHeight / 2));
            }
        }

        if (this.calloutLabel) {

            label = this.calloutLabel.label;

            if (label && this.calloutLabel.p && isVisible(label)) {
                xy = MeasureCommon.project(this.calloutLabel.p, this.viewer);
                placeLabel(Math.floor(label.clientWidth / 2), Math.floor(label.clientHeight / 2));
            }
        }

        if (this.areaLabel) {

            label = this.areaLabel.label;

            if (label && this.areaLabel.p1 && this.areaLabel.p2 && isVisible(label)) {
                point = { x: (this.areaLabel.p1.x + this.areaLabel.p2.x)/2, y: (this.areaLabel.p1.y + this.areaLabel.p2.y)/2, z: (this.areaLabel.p1.z + this.areaLabel.p2.z)/2 };
                xy = MeasureCommon.project(point, this.viewer);
                placeLabel(Math.floor(label.clientWidth / 2), Math.floor(label.clientHeight / 2));
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

        item.line = this.drawLineSegment(p1, p2, _segmentWidth, item.material);

        const tmpPoints = [new THREE.Vector3(), new THREE.Vector3()];
        const geometry = item.geometry = new THREE.BufferGeometry();
        var point = MeasureCommon.nearestPointInPointToSegment(self.viewer.navigation.getPosition(), p1, p2);
        var scale = self.setScale(point);

        var direction;
        const dimensionOffset = this.measurement.options && this.measurement.options.dimensionOffset;
        if (dimensionOffset) {
            const d1 = new THREE.Vector3(dimensionOffset[0].x, dimensionOffset[0].y, dimensionOffset[0].z);
            const d2 = new THREE.Vector3(dimensionOffset[1].x, dimensionOffset[1].y, dimensionOffset[1].z);
            direction = new THREE.Vector3().subVectors(p1, d1);
            this.segments.push({ line: this.drawLineSegment(d1, p1, _segmentWidth, item.material), p1: d1, p2: p1 });
            this.segments.push({ line: this.drawLineSegment(p2, d2, _segmentWidth, item.material), p1: p2, p2: d2});
            p1 = d1;
            p2 = d2;
        } else {
            direction = new THREE.Vector3().subVectors(p2, p1);
        }
        var normal = direction.cross(self.viewer.navigation.getEyeVector()).normalize();
        item.visible = true;

        this.segments.push(item);

        const dashedLeader = this.measurement.options && this.measurement.options.dashedLeader;
        if (dashedLeader) {
            const l1 = new THREE.Vector3(dashedLeader[0].x, dashedLeader[0].y, dashedLeader[0].z);
            const l2 = new THREE.Vector3(dashedLeader[1].x, dashedLeader[1].y, dashedLeader[1].z);
            this.drawLineSegment(l1, l2, _segmentWidth, item.material, true);
        }

        function drawTip(p) {
            // Edge
            tmpPoints[0].addVectors(p, normal.clone().multiplyScalar(_tipHeight * scale));
            tmpPoints[1].subVectors(p, normal.clone().multiplyScalar(_tipHeight * scale));
            geometry.setFromPoints(tmpPoints);

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

    proto.redrawDashedLine = function(dashedLine) {
        if (!dashedLine.p1 || !dashedLine.p2)
            return;

        this.viewer.impl.removeMultipleOverlays(this.overlayName, dashedLine.line, true);
        
        var p1Scale = this.setScale(dashedLine.p2);
        var dashSize = _dashSize * p1Scale;
        var gapSize = _gapSize * p1Scale;
        dashedLine.line = this.drawDashedLine(dashedLine.p2, dashedLine.p1, dashSize, gapSize, this.lines.xyz.material, _dashedSegmentWidth, this.overlayName);

        return dashedLine.line;
    };

    proto.redrawDashedLines = function() {
        this.dashedLines.forEach(this.redrawDashedLine.bind(this));
    };

    proto.drawLineSegment = function(p1, p2, width, material, isDashedLine) {
        var line;

        if (isDashedLine) {
            const dashedLine = {};
            dashedLine.p1 = p1;
            dashedLine.p2 = p2;
            this.dashedLines.push(dashedLine);
            line = this.redrawDashedLine(dashedLine);
        } else {
            const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
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
        this.applyLineColor(this.surfaceColor);
    
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


    proto.renderAreaMeasurementFromPoints = function(pickPositions) {
        let p1, p2;
        let firstPoint;

        const points = [];
        this.applyLineColor(this.lines.xyz.material);
        this.applyLineColor(this.surfaceColor);

        const keys = Object.keys(pickPositions);

        for (var i = 0; i < keys.length - 1; i++) {
            const key = parseFloat(keys[i]);
            const position1 = pickPositions[key];
            const position2 = pickPositions[key+1];

            if (i === 0) {
                firstPoint = new THREE.Vector3(position1.x, position1.y, position1.z);
            }

            p1 = new THREE.Vector3(position1.x, position1.y, position1.z);
            p2 = new THREE.Vector3(position2.x, position2.y, position2.z);

            this.drawSegmentAndPush(p1, p2);
            points.push(p1);
        }

        if (keys.length > 2) {
            // Draw last line
            this.drawSegmentAndPush(firstPoint, p2, !this.measurement.closedArea);
            
            if(!MeasureCommon.isEqualVectors(firstPoint,p2,MeasureCommon.EPSILON)){
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
            this.viewer.impl.removeOverlay(this.overlayName, this.angleArc, true);
            this.angleArc = null;
        }
        if (this.angleOutline.length > 0) {
            this.viewer.impl.removeMultipleOverlays(this.overlayName, this.angleOutline, true);
            this.angleOutline.length = 0;
        }
    };

    proto.drawAngle = function(p, ep1, ep2, n, angle, midPoint, _radius) {

        var smallNum = 0.001;

        if (!this.materialAngle) {

            this.materialAngle = new THREE.MeshPhongMaterial({
                    color: 0x999999,
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

        this.applyLineColor(this.lines.xyz.material);
        this.applyLineColor(this.surfaceColor);

        MeasureCommon.createCommonOverlay(this.viewer, this.overlayName);
        this.clearAngleMeshes();

        // draw arc of angle
        var radius = _radius || Math.min(p.distanceTo(ep1), p.distanceTo(ep2)) / 4;
        var segments = 100;
        //angle = angle * Math.PI / 180;

        var circleGeometry = new THREE.CircleBufferGeometry(radius, segments, 0, angle * Math.PI / 180);
        var arc = new THREE.Mesh(circleGeometry, this.surfaceColor);
        this.applyLineColor(this.surfaceColor);

        const arcGeomPosition = arc.geometry.getAttribute('position');
        {
            const untypedPositions = Array.from(arcGeomPosition.array); // convert from Float32Array to Array to use concat
            const untypedCenter = untypedPositions.slice(0, arcGeomPosition.itemSize); // get the x,y,z of the center
            arcGeomPosition.array = Float32Array.from(untypedPositions.concat(untypedCenter)); // concat the center x,y,z and convert back to Float32Array
            arcGeomPosition.count++;
            arcGeomPosition.needsUpdate = true;
        }

        // Translate and rotate the arc to the plane where it should lie in
        arc.position.set(p.x, p.y, p.z);
        var V = arc.position.clone();
        V.add(n);
        arc.lookAt(V);
        arc.updateMatrixWorld();


        // Rotate the arc in the plane to the right place
        let vA = new THREE.Vector3().fromBufferAttribute(arcGeomPosition, 1);
        let vB = new THREE.Vector3().fromBufferAttribute(arcGeomPosition, arcGeomPosition.count - 2);
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
        vA = new THREE.Vector3().fromBufferAttribute(arcGeomPosition, 1);
        vB = new THREE.Vector3().fromBufferAttribute(arcGeomPosition, arcGeomPosition.count - 2);
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
        const outlineGeometry = new THREE.CircleBufferGeometry(radius, segments, 0, angle * Math.PI / 180);
        {
            const outlineGeomPosition = outlineGeometry.getAttribute('position');
            outlineGeomPosition.array = outlineGeomPosition.array.slice(outlineGeomPosition.itemSize); // skip the first position's x,y,z
            outlineGeomPosition.count--;
            outlineGeomPosition.needsUpdate = true;
        }
        arc.updateMatrixWorld();
        outlineGeometry.applyMatrix4(arc.matrixWorld);
        this.angleOutline = this.drawEdgeAsCylinder(outlineGeometry, this.lines.xyz.material, _angleArcWidth, 0, this.getNewCylinderGeometry());

        this.angleArc = arc;
        this.viewer.impl.addOverlay(this.overlayName, this.angleArc);
        this.viewer.impl.addMultipleOverlays(this.overlayName, this.angleOutline);

        // This is used for angle label's position
        midPoint.fromBufferAttribute(arcGeomPosition, Math.round(arcGeomPosition.count / 2) - 1);
        midPoint.applyMatrix4(arc.matrixWorld);
        if (!_radius) {
            var dir = new THREE.Vector3();
            dir.subVectors(midPoint, p).normalize();
            dir.multiplyScalar(radius / 2);
            midPoint.add(dir);
        }
    };

    proto.createArcLabel = function() {
        var label = this.createMeasurementLabel();
        this.viewer.container.appendChild(label);
        label.addEventListener('mousewheel', this.viewer.toolController.mousewheel);
        label.addEventListener('click', this.onSelectionAreaClickedBinded);

        return label;
    };

    proto.clearArcMeshes = function() {
        if(this.arcOutline && this.arcOutline.length > 0) {
            this.viewer.impl.removeMultipleOverlays(this.overlayName, this.arcOutline, true);
            this.arcOutline.length = 0;
        }
    };

    proto.drawCircularArc = function(point1, point2, center, radius, drawTips=true) {
        var segments = 100;
        var edgeGeomtry = new THREE.BufferGeometry();
        const tmpPoints = [new THREE.Vector3(), new THREE.Vector3()];
        var nearPoint = MeasureCommon.nearestPointInPointToSegment(this.viewer.navigation.getPosition(), point1, point2);
        var scale = this.setScale(nearPoint);

        var point1Relative = new THREE.Vector3();
        point1Relative.subVectors(point1, center);
        var startAngle = Math.atan2(point1Relative.y, point1Relative.x);

        var point2Relative = new THREE.Vector3();
        point2Relative.subVectors(point2, center);
        var endAngle = Math.atan2(point2Relative.y, point2Relative.x);

        // Set this.lines with the points to rotabte the label
        this.arcLabel.point1Relative = point1Relative.clone();
        this.arcLabel.point2Relative = point2Relative.clone().normalize().multiplyScalar(radius);

        var arcAngle = endAngle - startAngle;
        if(arcAngle > Math.PI) {
            arcAngle -= 2 * Math.PI;
        } else if (arcAngle < -Math.PI) {
            arcAngle += 2 * Math.PI;
        }

        var circleGeometry = new THREE.CircleBufferGeometry(radius, segments, startAngle, arcAngle);
        var arc = new THREE.Mesh(circleGeometry, this.lines.xyz.material);

        // Translate and rotate the arc to the plane where it should lie in
        arc.position.set(center.x, center.y, center.z);
        {
            const circleGeomPosition = circleGeometry.getAttribute('position');
            circleGeomPosition.array = circleGeomPosition.array.slice(circleGeomPosition.itemSize); // skip the first position's x,y,z
            circleGeomPosition.count--;
            circleGeomPosition.needsUpdate = true;
        }

        arc.updateMatrixWorld();
        circleGeometry.applyMatrix4(arc.matrixWorld);

        MeasureCommon.createCommonOverlay(this.viewer, this.overlayName);
        this.clearArcMeshes();
        this.arcOutline = this.drawEdgeAsCylinder(circleGeometry, this.lines.xyz.material, _segmentWidth, 0, this.getNewCylinderGeometry());

        this.viewer.impl.addMultipleOverlays(this.overlayName, this.arcOutline);

        function drawArcTip(p, normal) {
            tmpPoints[0].addVectors(p, normal.clone().multiplyScalar(_tipHeight * scale));
            tmpPoints[1].subVectors(p, normal.clone().multiplyScalar(_tipHeight * scale));

            edgeGeomtry.setFromPoints(tmpPoints);

            var line = this.drawLineAsCylinder(edgeGeomtry, this.lines.xyz.material, _tipWidth, this.overlayName);
            this.arcTip.push(line);
        }
        
        // Draw arc's tip lines
        if(drawTips) {
            drawArcTip.call(this, point1, point1Relative.normalize());
            drawArcTip.call(this, point2, point2Relative.normalize());
        }
        
        var midPoint = new THREE.Vector3();

        // Calculate midpoint position
        var midAngle = startAngle + (arcAngle * 0.5);
        midPoint.x = Math.cos(midAngle) * radius;
        midPoint.y = Math.sin(midAngle) * radius;
        this.arcLabel.midPointRelative = midPoint.clone();
        midPoint.applyMatrix4(arc.matrixWorld);

        this.showArcLabel(midPoint);
    };

    proto.renderAngleMeasurementFromPoints = function(pickPositions) {
        var points = [];
        
        const keys = Object.keys(pickPositions);
        for (var i = 0; i < keys.length; i++) {
            const key = parseFloat(keys[i]);
            const position = pickPositions[key];

            points.push(new THREE.Vector3(position.x, position.y, position.z));
        }

        if (points.length === 3) {
            let arcRadius;
            const options = this.measurement.options;
            if (options && options.offset) {
                const o0 = new THREE.Vector3(options.offset.x, options.offset.y, options.offset.z);
                const o1 = o0.clone().add(points[1]);
                o0.add(points[0]);
                this.drawSegmentAndPush(o0, o1);
                this.drawSegmentAndPush(points[1], points[2]);
                this.drawSegmentAndPush(points[0], o0, true);
                this.drawSegmentAndPush(points[1], o1, true);
                arcRadius = o1.clone().sub(o0).length();
            } else {
                this.drawSegmentAndPush(points[0], points[1]);
                this.drawSegmentAndPush(points[1], points[2]);
            }

            if (this.measurement.angle) {
                var n = new THREE.Vector3();
                var v1 = new THREE.Vector3();
                var v2 = new THREE.Vector3();
                v1.subVectors(points[0], points[1]);
                v2.subVectors(points[1], points[2]);
                n.crossVectors(v1, v2);
                n.normalize();

                var midPoint = new THREE.Vector3();
                this.drawAngle(points[1], points[0], points[2], n, this.measurement.angle, midPoint, arcRadius);
                this.showAngleLabel(midPoint);
                this.updateAngle();
            }
        }
    };

    proto.renderAngleMeasurement = function(picks) {

        var count = this.measurement.countPicks();
        var p1, p2;

        var points = [];
        this.applyLineColor(this.lines.xyz.material);
        this.applyLineColor(this.surfaceColor);
        
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

    proto.renderArcMeasurementFromPoints = function(p1, p2, center, radius) {
        if (!p1 || !p2 || !center || !radius) {
            return;
        }
        this.drawCircularArc(p1, p2, center, radius);
        this.updateArcLength();
    };

    proto.renderArcMeasurement = function(p1, p2) {

        if(!p1 || !p2 || !p1.circularArcCenter|| !p1.circularArcRadius) {
            return;
        }

        var radius = p1.circularArcRadius;
        var center = p1.circularArcCenter;
        
        var point1 = MeasureCommon.getSnapResultPosition(p1);
        var point2 = MeasureCommon.getSnapResultPosition(p2);

        const drawTips =
            this.showMeasureResult &&
            MeasureCommon.isEqualVectors(p1.circularArcCenter, p2.circularArcCenter, 0) &&
            p1.circularArcRadius === p2.circularArcRadius;

        this.drawCircularArc(point1, point2, center, radius, drawTips);
        this.updateArcLength();
        
    };

    proto.renderLocationMeasurementFromPoints = function(pickPositions) {
        var p1 = pickPositions[1];
        var p2 = pickPositions[2];
        if (!p1 || !p2)
            return;
        
        this.applyLineColor(this.lines.xyz.material);
        this.drawSegmentAndPush(p1, p2);

        this.showLocationLabel(p2);
        this.updateLocation();
    };

    proto.renderLocationMeasurement = function(picks) {
        var p1 = picks[1] && picks[1].intersection;
        var p2 = picks[2] && picks[2].intersection;
        if (!p1 || !p2)
            return;
        
        this.applyLineColor(this.lines.xyz.material);
        this.drawSegmentAndPush(p1, p2);

        this.showLocationLabel(p2);
        this.updateLocation();
    };

    proto.renderCalloutMeasurementFromPoints = function(pickPositions) {
        var p1 = pickPositions[1];
        var p2 = pickPositions[2];
        if (!p1 || !p2)
            return;

        this.applyLineColor(this.lines.xyz.material);
        this.drawSegmentAndPush(p1, p2);

        this.showCalloutLabel(p2);
        this.updateCallout();
    };

    proto.renderCalloutMeasurement = function(picks) {
        var p1 = picks[1] && picks[1].intersection;
        var p2 = picks[2] && picks[2].intersection;
        if (!p1 || !p2)
            return;
        
        this.applyLineColor(this.lines.xyz.material);
        this.drawSegmentAndPush(p1, p2);

        this.showCalloutLabel(p2);
        this.updateCallout();
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

    proto.updateLine = function(item, x1, y1, z1, x2, y2, z2, showAxis) {
        this.applyLineColor(this.lines.xyz.material);

        var line = item.line,
            label = item.label,
            p1 = new THREE.Vector3(x1, y1, z1),
            p2 = new THREE.Vector3(x2, y2, z2);

        // Swap points if needed to have consistent axis directions.
        var tmpVec;
        if (item === this.lines.x && p2.x > p1.x) {
            tmpVec = p1.clone();
            p1 = p2.clone();
            p2 = tmpVec.clone();
        } 
        else if (item === this.lines.y && p2.y > p1.y) {
            tmpVec = p1.clone();
            p1 = p2.clone();
            p2 = tmpVec.clone();
        } 
        else if (item === this.lines.z && p2.z > p1.z) {
            tmpVec = p1.clone();
            p1 = p2.clone();
            p2 = tmpVec.clone();
        }

        item.line = null;            

        if (!label) {
            label = this.createDistanceLabel(item);
        }
        else {
            this.hideLabel(label);
        }
        
        if (((this.isLeaflet && item !== this.lines.z) || (p1.distanceTo(p2) >= MeasureCommon.EPSILON)) && showAxis) {

            item.p1 = p1;
            item.p2 = p2;

            if (item === this.lines.xyz) {
                this.drawXYZLine(item);
                this.showLabel(label);
                this.updateDistance();
            }
            else {
                line = item.line = this.drawLineSegment(p1, p2, _axisLineWidth, item.material);
                var show = !this.simple && this.showMeasureResult;

                line.visible = show;
                item.visible = show;

                if (show) {
                    this.showLabel(label);
                }
                else {
                    this.hideLabel(label);
                }
            }
        }
    };

    // Draw distance measurement
    proto.renderDistanceMeasurementFromPoints = function(p1, p2) {

        this.updateLine(this.lines.xyz, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, true);

        var up = this.viewer.navigation.getAlignedUpVector(),
            x = Math.abs(up.x),
            y = Math.abs(up.y),
            z = Math.abs(up.z);

        var showAxis = false;

        if (z > x && z > y) { // z up
            this.updateLine(this.lines.x, p1.x, p1.y, p1.z, p2.x, p1.y, p1.z, showAxis);
            this.updateLine(this.lines.y, p2.x, p1.y, p1.z, p2.x, p2.y, p1.z, showAxis);
            this.updateLine(this.lines.z, p2.x, p2.y, p1.z, p2.x, p2.y, p2.z, showAxis);

        } else if (y > x && y > z) { // y up
            this.updateLine(this.lines.x, p1.x, p1.y, p1.z, p2.x, p1.y, p1.z, showAxis);
            this.updateLine(this.lines.z, p2.x, p1.y, p1.z, p2.x, p1.y, p2.z, showAxis);
            this.updateLine(this.lines.y, p2.x, p1.y, p2.z, p2.x, p2.y, p2.z, showAxis);

        } else { // x up - do we ever see this?
            this.updateLine(this.lines.y, p1.x, p1.y, p1.z, p1.x, p2.y, p1.z, showAxis);
            this.updateLine(this.lines.z, p1.x, p2.y, p1.z, p1.x, p2.y, p2.z, showAxis);
            this.updateLine(this.lines.x, p1.x, p2.y, p2.z, p2.x, p2.y, p2.z, showAxis);
        }

    };

    // Draw distance measurement
    proto.renderDistanceMeasurement = function(p1, p2)
    {
        var self = this;

        // If the line aligns with one of axis, then don't show axis
        function displayAxis(p1, p2) {
            self.tmpVector.subVectors(p1, p2);
            self.tmpVector.normalize();

            return !MeasureCommon.isParallel(self.tmpVector, self.xAxis) && !MeasureCommon.isParallel(self.tmpVector, self.yAxis) && !MeasureCommon.isParallel(self.tmpVector, self.zAxis);
        }

        this.updateLine(this.lines.xyz, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, true);

        var up = this.viewer.navigation.getAlignedUpVector(),
            x = Math.abs(up.x),
            y = Math.abs(up.y),
            z = Math.abs(up.z);

        var showAxis = displayAxis(p1, p2);

        if (z > x && z > y) { // z up
            this.updateLine(this.lines.x, p1.x, p1.y, p1.z, p2.x, p1.y, p1.z, showAxis);
            this.updateLine(this.lines.y, p2.x, p1.y, p1.z, p2.x, p2.y, p1.z, showAxis);
            this.updateLine(this.lines.z, p2.x, p2.y, p1.z, p2.x, p2.y, p2.z, showAxis);

        } else if (y > x && y > z) { // y up
            this.updateLine(this.lines.x, p1.x, p1.y, p1.z, p2.x, p1.y, p1.z, showAxis);
            this.updateLine(this.lines.z, p2.x, p1.y, p1.z, p2.x, p1.y, p2.z, showAxis);
            this.updateLine(this.lines.y, p2.x, p1.y, p2.z, p2.x, p2.y, p2.z, showAxis);

        } else { // x up - do we ever see this?
            this.updateLine(this.lines.y, p1.x, p1.y, p1.z, p1.x, p2.y, p1.z, showAxis);
            this.updateLine(this.lines.z, p1.x, p2.y, p1.z, p1.x, p2.y, p2.z, showAxis);
            this.updateLine(this.lines.x, p1.x, p2.y, p2.z, p2.x, p2.y, p2.z, showAxis);
        }

    };

    proto.updateResults = function() {
        this.updateDistance();
        this.updateAngle();
        this.updateArea();
        this.updateArcLength();
        
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

    // Update location measurement label
    proto.updateLocation = function() {
        setValueMeasurementLabelText(this.locationLabel.label,
            ("~ " + this.measureTool.getLocation(this.measurement)).split('\n').join('\n~ '));
    };

    // Update callout measurement label
    proto.updateCallout = function() {
        setValueMeasurementLabelCallout(this.calloutLabel.label, this.measureTool.getCallout(this.measurement));
    };

    // Update area measurement label
    proto.updateArea = function() {
        setValueMeasurementLabelText(this.areaLabel.label, "~ " + this.measureTool.getArea(this.measurement));
    };

    // Update arc measurement label
    proto.updateArcLength = function() {
        setValueMeasurementLabelText(this.arcLabel.label, "~ " + this.measureTool.getArc(this.measurement));
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

        if (this.arcLabel.label) {
            this.arcLabel.label.style.pointerEvents = value;
        }
    };

    proto.setLabelsZIndex = function(zIndex) {
        for (var name in this.lines) {
            if (Object.prototype.hasOwnProperty.call(this.lines, name)) {
                var item = this.lines[name];
                if (item.label) {
                    item.label.style.zIndex = zIndex;
                }
            }
        }

        if (this.angleLabel && this.angleLabel.label) {
            this.angleLabel.label.style.zIndex = zIndex;    
        }

        if (this.locationLabel && this.locationLabel.label) {
            this.locationLabel.label.style.zIndex = zIndex;    
        }

        if (this.calloutLabel && this.calloutLabel.label) {
            this.calloutLabel.label.style.zIndex = zIndex;    
        }

        if (this.areaLabel && this.areaLabel.label) {
            this.areaLabel.label.style.zIndex = zIndex;    
        }

        if (this.arcLabel && this.arcLabel.label) {
            this.arcLabel.label.style.zIndex = zIndex;    
        }

        for (name in this.endpoints) {
            if (Object.prototype.hasOwnProperty.call(this.endpoints, name)) {
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
            if (Object.prototype.hasOwnProperty.call(this.endpoints, name)) {
                var endpoint = this.endpoints[name];
                if (endpoint.label) {
                    this.hideLabel(endpoint.label);
                }
            }
        }

        for (name in this.lines) {
            if (Object.prototype.hasOwnProperty.call(this.lines, name)) {
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

        if (this.locationLabel && this.locationLabel.label) {
            this.hideLabel(this.locationLabel.label);
        }

        if (this.calloutLabel && this.calloutLabel.label) {
            this.hideLabel(this.calloutLabel.label);
        }

        if (this.areaLabel && this.areaLabel.label) {
            this.hideLabel(this.areaLabel.label);
        }

        if (this.arcLabel && this.arcLabel.label) {
          this.hideLabel(this.arcLabel.label);
        }
        
        this.clearSelectionAreas();

        this.segments = [];
        this.dashedLines = [];

        this.viewer.impl.clearOverlay(this.overlayName, true);
        MeasureCommon.createCommonOverlay(this.viewer, this.overlayName);
    };

    proto.hideClick = function(pickNumber) {

        Indicator.prototype.hideClick.call(this, pickNumber);

        for (var name in this.lines) {
            if (Object.prototype.hasOwnProperty.call(this.lines, name)) {
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

        if (this.arcLabel && this.arcLabel.label) {
            this.hideLabel(this.arcLabel.label);
        }

        this.enableSelectionAreas(item.selectionArea, false);
    };

    proto.destroy = function() {
        var name;

        Indicator.prototype.destroy.call(this);

        for (name in this.lines) {
            if (Object.prototype.hasOwnProperty.call(this.lines, name)) {
                var item = this.lines[name];
                if (item.line) {
                    this.viewer.impl.clearOverlay(self.overlayName, true);
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

        
        this.clearArcMeshes();

        if (this.arcLabel && this.arcLabel.label) {
            this.arcLabel.label.parentNode.removeChild(this.arcLabel.label);
            this.arcLabel.label.removeEventListener('mousewheel', this.viewer.toolController.mousewheel);
            this.arcLabel.label.removeEventListener('click', this.onSelectionAreaClickedBinded);
            this.arcLabel.label = this.arcLabel.midPoint = null;
        }


        if (this.locationLabel && this.locationLabel.label) {
            this.locationLabel.label.parentNode.removeChild(this.locationLabel.label);
            this.locationLabel.label.removeEventListener('mousewheel', this.viewer.toolController.mousewheel);
            //this.locationLabel.label.removeEventListener('click', this.onSelectionAreaClickedBinded);
             this.locationLabel.label = this.locationLabel.p = null;
        }

        
        if (this.calloutLabel && this.calloutLabel.label) {
            this.calloutLabel.label.parentNode.removeChild(this.calloutLabel.label);
            this.calloutLabel.label.removeEventListener('mousewheel', this.viewer.toolController.mousewheel);
            //this.calloutLabel.label.removeEventListener('click', this.onSelectionAreaClickedBinded);
             this.calloutLabel.label = this.calloutLabel.p = null;
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
        this.viewer.impl.removeOverlay(this.overlayName, this.lines.xyz.line, true);

        this.lines.xyz.tips && this.lines.xyz.tips.forEach(function(tip) {
            this.viewer.impl.removeOverlay(this.overlayName, tip, true);
        }.bind(this));
    };

    // Update scale for vertex, edge, line and extension dash line
    proto.updateScale = function() {
        var name;

        this.angleOutline.forEach(cylinderMesh => this.setCylinderScale(cylinderMesh));

        this.arcOutline.forEach(cylinderMesh => this.setCylinderScale(cylinderMesh));        
        
        for (name in this.lines) {
            if (Object.prototype.hasOwnProperty.call(this.lines, name)) {
                var item = this.lines[name];
                if (item.line && item !== this.lines.xyz) {
                    this.setCylinderScale(item.line, item.p1, item.p2);
                }
            }
        }
        
        for (name in this.segments) {
            if (Object.prototype.hasOwnProperty.call(this.segments, name)) {
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

        if (this.measurement.measurementType === MeasureCommon.MeasurementTypes.MEASUREMENT_ARC) {
            this.arcTip.forEach(cylinderMesh => 
            {
                var scale = this.setScale(cylinderMesh.position);
                if (Object.prototype.hasOwnProperty.call(cylinderMesh, "lmv_line_width")) {
                    var scaleXZ = scale * cylinderMesh.lmv_line_width;
                    cylinderMesh.scale.x = scaleXZ;
                    cylinderMesh.scale.z = scaleXZ;
                }
                var scaleY = scale * (2 * _tipHeight);
                cylinderMesh.scale.y = scaleY;
            });
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

    // Escape special characters in HTML and convert \n to <br>
    function escapeHtml(str) {
        return str
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;")
             .replace(/\n/g, '<br>');
    }

    // Create a space with formatting from format
    function createSpan(format) {
        // If format is a string, no formatting - just return the escaped string
        if (typeof format === 'string')
            return escapeHtml(format);

        // Build the style parameters for font-size and font-weight
        let space = '';
        let fontSize = format.fontSize;
        if (format.fontSize !== undefined && format.fontSize !== 10) {
            // Base the fontSize on 10 === 100% which is ADRs default
            // LMV uses 12 as the default.
            fontSize = `font-size: ${0 | (fontSize * 10)}%;`;
            space = ' ';    // Put a space between font-size and bold
        } else
            fontSize = '';
        let bold = format.bold;
        if (bold !== undefined)
            bold = `${space}font-weight: ${bold ? 'bold' : 'normal'};`;
        else
            bold = '';
        // Escape the string.
        const str = escapeHtml(format.text);
        // Include bold and fontSize styles if present.
        if (bold || fontSize)
            return `<span style="${fontSize}${bold}">${str}</span>`;
        // return escaped string if no formatting
        return str;
    }

    function setValueMeasurementLabelCallout(label, calloutValue) {
        // If the calloutValue is just a string, then set it as text.
        if (typeof calloutValue === 'string') {
            setValueMeasurementLabelText(label, calloutValue);
            return;
        }

        var div = label.querySelector('.measure-length-text');
        if (div) {
            // construct and set the html for the callout.
            if (!Array.isArray(calloutValue))
                div.innerHTML = createSpan(calloutValue);
            else
                div.innerHTML = calloutValue.map(createSpan).join('');
        }
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

    proto.showArcLabel  = function(midPoint) {

        var label = this.arcLabel.label;

        if (!label) {
            this.arcLabel.label = label = this.createArcLabel();
        }
        else {
            this.hideLabel(label);
        }
        this.updateArcLength();
        this.showLabel(label);

        this.arcLabel.p1 = midPoint.clone();
        this.arcLabel.p2 = midPoint.clone();

    };

    proto.showLocationLabel = function(p) {

        var label = this.locationLabel.label;

        if (!label) {
            label = this.locationLabel.label = this.createMeasurementLabel();
            label.style.whiteSpace = 'pre-line';
            label.style.height = 'auto';
            label.style.textAlign = 'start';
            label.querySelector('.measure-delta-text').style.display = 'none';
            this.viewer.container.appendChild(label);
            label.addEventListener('mousewheel', this.viewer.toolController.mousewheel);
            //label.addEventListener('click', this.onSelectionAreaClickedBinded);
        }

        this.updateLocation();
        this.showLabel(label);

        this.locationLabel.p = p.clone();

    };

    proto.showCalloutLabel = function(p) {

        var label = this.calloutLabel.label;

        if (!label) {
            label = this.calloutLabel.label = this.createMeasurementLabel();
            label.style.whiteSpace = 'pre-line';
            label.style.height = 'auto';
            label.style.textAlign = 'start';
            if (this.measurement.options && this.measurement.options.width)
                label.style.width = this.measurement.options.width + 'px';
            label.querySelector('.measure-delta-text').style.display = 'none';
            this.viewer.container.appendChild(label);
            label.addEventListener('mousewheel', this.viewer.toolController.mousewheel);
            //label.addEventListener('click', this.onSelectionAreaClickedBinded);
        }

        this.updateCallout();
        this.showLabel(label);

        this.calloutLabel.p = p.clone();

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
        this.viewer.dispatchEvent({ type: MeasureCommon.Events.SELECT_MEASUREMENT, data: { id: this.measurement.id }});
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

    proto.renderFromPoints = function(pointData, showMeasureResult) {
        Indicator.prototype.renderFromPoints.call(this, pointData, showMeasureResult);

        this.updateSelectionArea();
    };

    proto.onCameraChange = function() {
        this.redrawDashedLines();
        this.updateSelectionArea();
        this.hideLabelsOutsideOfView();
        this.updateLabelsPosition();
    };

    proto.handleResize = function() {
        this.redrawDashedLines();
        this.updateSelectionArea();
        this.updateLabelsPosition();
    };

