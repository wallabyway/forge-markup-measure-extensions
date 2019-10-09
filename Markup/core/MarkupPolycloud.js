'use strict';

import { Markup } from './Markup'
import * as MarkupTypes from './MarkupTypes'
import { createMarkupPathSvg, composeRGBAString, setAttributeToMarkupSvg,
    updateMarkupPathSvgHitarea, addMarkupMetadata } from './MarkupsCoreUtils'
import { cloneStyle } from './StyleUtils'
import { EditModePolycloud } from './edit-modes/EditModePolycloud'

    /**
     *
     * @param id
     * @param editor
     * @constructor
     */
    export function MarkupPolycloud(id, editor) {

        var styleAttributes = ['stroke-width', 'stroke-color','stroke-opacity', 'fill-color', 'fill-opacity'];
        Markup.call(this, id, editor, styleAttributes);

        // bind to this to pass this.globalManager
        this.addMarkupMetadata = addMarkupMetadata.bind(this);

        this.type = MarkupTypes.MARKUP_TYPE_POLYCLOUD;
        this.locations = [];
        this.shape = createMarkupPathSvg();

        this.bindDomEvents();
    }

    MarkupPolycloud.prototype = Object.create(Markup.prototype);
    MarkupPolycloud.prototype.constructor = MarkupPolycloud;

    var proto = MarkupPolycloud.prototype;

    proto.getEditMode = function() {

        return new EditModePolycloud(this.editor);
    };

    /**
     *
     * Sets top-left and bottom-right values in client space coordinates (2d).
     * @param position
     * @param size
     * @param locations
     * @param closed
     */
    proto.set = function(position, size, locations, closed) {

        this.rotation = 0; // Reset angle //
        this.locations = locations.concat();

        this.size.x = (size.x === 0) ? 1 : size.x;
        this.size.y = (size.y === 0) ? 1 : size.y;

        this.closed = closed;

        this.setSize(position, size.x, size.y);
        this.updateStyle();
    };

    /**
     * Applies data values into DOM element style/attribute(s)
     *
     */
    proto.updateStyle = function() {

        var style = this.style;
        var shape = this.shape;
        var path = this.getPath().join(' ');

        var strokeWidth = this.style['stroke-width'];
        var strokeColor = this.highlighted ? this.highlightColor : composeRGBAString(style['stroke-color'], style['stroke-opacity']);
        var fillColor = this.closed ? composeRGBAString(style['fill-color'], style['fill-opacity']) : 'none';
        var transform = this.getTransform();

        setAttributeToMarkupSvg(shape, 'd', path);
        setAttributeToMarkupSvg(shape, 'stroke-width', strokeWidth);
        setAttributeToMarkupSvg(shape, 'stroke', strokeColor);
        setAttributeToMarkupSvg(shape, 'fill', fillColor);
        setAttributeToMarkupSvg(shape, 'transform', transform);
        updateMarkupPathSvgHitarea(shape, this.editor);
    };

    /**
     * Changes the position and size of the markup.
     * This gets called by the Autodesk.Viewing.Extensions.Markups.Core.SetSize edit action
     * @param {{x: Number, y: Number}} position
     * @param {Number} width
     * @param {Number} height
     */
    proto.setSize = function (position, width, height) {

        width = (width === 0 ? 1 : width);
        height = (height === 0 ? 1 : height);

        var locations = this.locations;
        var locationsCount = locations.length;

        var scaleX = width / this.size.x;
        var scaleY = height / this.size.y;

        for(var i = 0; i < locationsCount; ++i) {

            var point = locations[i];

            point.x *= scaleX;
            point.y *= scaleY;
        }

        this.position.x = position.x;
        this.position.y = position.y;

        this.size.x = width;
        this.size.y = height;

        this.updateStyle();
    };

    proto.setMetadata = function() {

        var metadata = cloneStyle(this.style);

        metadata.type = this.type;
        metadata.position = [this.position.x, this.position.y].join(" ");
        metadata.size = [this.size.x, this.size.y].join(" ");
        metadata.rotation = String(this.rotation);
        metadata.locations = this.locations.map(function(point){
            return [point.x, point.y].join(" ");
        }).join(" ");

        return this.addMarkupMetadata(this.shape, metadata);
    };

    proto.getPath = function() {

        function getOrientation(locations) {

            switch (locations.length) {

                case 0:
                case 1:
                    return 1;
                case 2:

                    var fstPoint = locations[0];
                    var sndPoint = locations[1];

                    return fstPoint.y > sndPoint.y ? 1 : -1;
                default:

                    var pointA = locations[0];
                    var pointB = locations[1];
                    var pointC = locations[2];

                    var orientation =
                        (pointB.x - pointA.x) * (pointB.y + pointA.y) +
                        (pointC.x - pointB.x) * (pointC.y + pointB.y);

                    return orientation < 0 ? 1 : -1;
            }
        }

        function getSides(locations, closed) {

            var locationsCount = locations.length;

            var sides = [];
            var sidesCount = locationsCount - (closed ? 0 : 1);

            for(var i = 0; i < sidesCount; ++i) {

                var locationA = locations[i];
                var locationB = locations[(i+1)%locationsCount];

                var dx = locationB.x - locationA.x;
                var dy = locationB.y - locationA.y;

                var length = Math.sqrt(dx * dx + dy * dy);

                sides.push({
                    index: i,
                    pointA: new THREE.Vector3(locationA.x, locationA.y, 0),
                    pointB: new THREE.Vector3(locationB.x, locationB.y, 0),
                    vecAB:  new THREE.Vector3(dx / length, dy / length, 0),
                    vecBA:  new THREE.Vector3(-dx / length, -dy / length, 0),
                    length: length
                });
            }

            return sides;
        }

        function updateCorners(side, cornerA, cornerB, orientation) {
            var rA = cornerA.radius;
            var rB = cornerB.radius;
            var D = side.length;

            if (rA > 0 && rB > 0 && rA + rB > D && Math.abs(rA - rB) < D) {
                // Corner arcs overlap, so correct them by finding the circle-circle intersection
                var a = side.pointA.x;
                var b = side.pointA.y;
                var c = side.pointB.x;
                var d = side.pointB.y;

                var delta = 0.25 * Math.sqrt((D + rA + rB) * (D + rA - rB) * (D - rA + rB) * (-D + rA + rB));
                var xS = (a + c) / 2 + (c - a) * (rA*rA - rB*rB) / (2*D*D);
                var xT = 2*(b - d) / (D*D) * delta;
                var yS = (b + d) / 2 + (d - b) * (rA*rA - rB*rB) / (2*D*D);
                var yT = 2*(a - c) / (D*D) * delta;
                var x1 = xS + xT;
                var x2 = xS - xT;
                var y1 = yS - yT;
                var y2 = yS + yT;
                var testPointOnCircle = Math.abs((x1 - a) * (x1 - a) + (y1 - b) * (y1 - b) - rA * rA);
                if (testPointOnCircle > 0.0000001) {
                    var tmp = y1;
                    y1 = y2;
                    y2 = tmp;
                }

                var intersec = new THREE.Vector3(x1, y1, 0);
                var intersecSide = Math.sign(intersec.clone().sub(side.pointA).cross(side.vecAB).z);
                if (intersecSide !== orientation) {
                    intersec.set(x2, y2, 0);
                }

                cornerA.pointB = intersec.clone();
                cornerB.pointA = intersec.clone();

                return true;
            }

            return false;
        }

        function updateSides(sides, corners, radius, orientation) {

            var diameter = radius * 2;
            var sidesCount = sides.length;

            for(var i = 0; i < sidesCount; ++i) {

                var side = sides[i];
                var cornerA = corners[i];
                var cornerB = corners[(i+1)%sidesCount];

                side.bodyA = side.vecAB.clone().multiplyScalar(cornerA.radius).add(side.pointA);
                side.bodyB = side.vecBA.clone().multiplyScalar(cornerB.radius).add(side.pointB);

                if (updateCorners(side, cornerA, cornerB, orientation)) {
                    side.body = 0;
                    side.bodyDiameter = side.bodyCount = 0;
                } else {
                    side.body = side.bodyB.clone().sub(side.bodyA).length();
                    side.bodyCount = Math.round(side.body / diameter);
                    if (side.bodyCount === 0 && side.body > 0.5*radius) {
                        side.bodyCount = 1;
                    }
                    side.bodyDiameter = diameter + (side.body - diameter * side.bodyCount) / side.bodyCount;
                }

                side.bodyRadius = side.bodyDiameter * 0.5;
            }
        }

        function getCorners(sides, radius, closed) {

            var corners = [];
            var sidesCount = sides.length;

            for(var i = 0; i < sidesCount; ++i) {

                var sideA = sides[i !== 0 ? i-1 : sidesCount-1];
                var sideB = sides[i];
                var large = sideA.vecBA.clone().cross(sideB.vecAB).z < 0;

                var sidesTooShort = sideA.length < radius || sideB.length < radius;
                if (sidesTooShort || (i === 0 && !closed)) {

                    corners.push({
                        pointA: sideB.pointA.clone(),
                        pointB: sideB.pointA.clone(),
                        radius: 0,
                        large: false
                    });
                } else {

                    corners.push({
                        pointA: sideB.pointA.clone().add(sideA.vecBA.clone().multiplyScalar(radius)),
                        pointB: sideB.pointA.clone().add(sideB.vecAB.clone().multiplyScalar(radius)),
                        radius: radius,
                        large: large
                    });
                }
            }

            return corners;
        }

        function createSidePath(side, orientation, path) {

            var count = side.bodyCount;
            if (count === 0) {
                return;
            }

            var radius = side.bodyRadius;
            var diameter = side.bodyDiameter;

            var xValueInset = diameter * 0.05;
            var yValueOffset = radius * 3.5 / 3.0;

            var p1 = new THREE.Vector3(xValueInset, orientation * -yValueOffset);
            var p2 = new THREE.Vector3(diameter - xValueInset, orientation * -yValueOffset);
            var p3 = new THREE.Vector3(diameter, 0);

            var angle = Math.acos(side.vecAB.x) * (side.vecAB.y < 0 ? -1 : 1);
            var rotation = new THREE.Matrix4().makeRotationZ(angle);

            p1.applyMatrix4(rotation);
            p2.applyMatrix4(rotation);
            p3.applyMatrix4(rotation);

            for (var i = 0; i < count; ++i) {

                path.push('c');
                path.push(p1.x);
                path.push(p1.y);
                path.push(p2.x);
                path.push(p2.y);
                path.push(p3.x);
                path.push(p3.y);
            }
        }

        function createCornerPath(corner, first, orientation, path) {

            if (first) {

                path.push('M');
                path.push(corner.pointA.x);
                path.push(corner.pointA.y);
            }

            var large = orientation === 1 ? corner.large : !corner.large;

            if (corner.radius !== 0) {

                path.push('a');
                path.push(corner.radius);
                path.push(corner.radius);
                path.push(0);
                path.push(large ? 1 : 0);
                path.push(orientation === 1 ? 1 : 0);
                path.push(corner.pointB.x - corner.pointA.x);
                path.push(corner.pointB.y - corner.pointA.y);
            }
            return path;
        }


        var strokeWidth = this.style['stroke-width'];
        var radius = strokeWidth * 2;
        var orientation = getOrientation(this.locations);
        var closed = this.closed;
        var path = [];

        var sides = getSides(this.locations, closed);
        var corners = getCorners(sides, radius, closed);
        var cornersCount = corners.length;

        updateSides(sides, corners, radius, orientation);

        for(var i = 0; i < cornersCount; ++i) {

            createCornerPath(corners[i], i === 0, orientation, path);
            createSidePath(sides[i], orientation, path);
        }

        closed && path.push('z');
        return path;
    };
