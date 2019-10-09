    // Centroid of a polygon is the average of its points.
    export function getCentroidOfPolygon(points) {
        var centroid = new THREE.Vector3();
        var n = points.length;

        for (var i = 0; i < n; i++) {
            centroid.add(points[i]);
        }

        centroid.multiplyScalar(1 / n);
        return centroid;
    }

    // Algorithm based on https://github.com/mapbox/polylabel
    export function getPolygonVisualCenter(polygon) {
        function compareMax(a, b) {
            return b.max - a.max;
        }

        function Cell(x, y, h, polygon) {
            this.x = x; // cell center x
            this.y = y; // cell center y
            this.h = h; // half the cell size
            this.d = pointToPolygonDist(x, y, polygon); // distance from cell center to polygon
            this.max = this.d + this.h * Math.SQRT2; // max distance to polygon within a cell
        }

        // signed distance from point to polygon outline (negative if point is outside)
        function pointToPolygonDist(x, y, polygon) {
            var inside = false;
            var minDistSq = Infinity;

            for (var k = 0; k < polygon.length; k++) {
                var ring = polygon[k];

                for (var i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
                    var a = ring[i];
                    var b = ring[j];

                    if ((a.y > y !== b.y > y) &&
                        (x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x)) inside = !inside;

                    minDistSq = Math.min(minDistSq, getSegDistSq(x, y, a, b));
                }
            }

            return (inside ? 1 : -1) * Math.sqrt(minDistSq);
        }

        // get polygon centroid
        function getCentroidCell(polygon) {
            var area = 0;
            var x = 0;
            var y = 0;
            var points = polygon[0];

            for (var i = 0, len = points.length, j = len - 1; i < len; j = i++) {
                var a = points[i];
                var b = points[j];
                var f = a.x * b.y - b.x * a.y;
                x += (a.x + b.x) * f;
                y += (a.y + b.y) * f;
                area += f * 3;
            }
            if (area === 0) return new Cell(points[0].x, points[0].y, 0, polygon);
            return new Cell(x / area, y / area, 0, polygon);
        }

        // get squared distance from a point to a segment
        function getSegDistSq(px, py, a, b) {

            var x = a.x;
            var y = a.y;
            var dx = b.x - x;
            var dy = b.y - y;

            if (dx !== 0 || dy !== 0) {

                var t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);

                if (t > 1) {
                    x = b.x;
                    y = b.y;

                } else if (t > 0) {
                    x += dx * t;
                    y += dy * t;
                }
            }

            dx = px - x;
            dy = py - y;

            return dx * dx + dy * dy;
        }

        function TinyQueue(data, compare) {

            function defaultCompare(a, b) {
                return a < b ? -1 : a > b ? 1 : 0;
            }

            if (!(this instanceof TinyQueue)) return new TinyQueue(data, compare);

            this.data = data || [];
            this.length = this.data.length;
            this.compare = compare || defaultCompare;

            if (this.length > 0) {
                for (var i = (this.length >> 1); i >= 0; i--) this._down(i);
            }
        }

        TinyQueue.prototype = {

            push: function (item) {
                this.data.push(item);
                this.length++;
                this._up(this.length - 1);
            },

            pop: function () {
                if (this.length === 0) return undefined;

                var top = this.data[0];
                this.length--;

                if (this.length > 0) {
                    this.data[0] = this.data[this.length];
                    this._down(0);
                }
                this.data.pop();

                return top;
            },

            peek: function () {
                return this.data[0];
            },

            _up: function (pos) {
                var data = this.data;
                var compare = this.compare;
                var item = data[pos];

                while (pos > 0) {
                    var parent = (pos - 1) >> 1;
                    var current = data[parent];
                    if (compare(item, current) >= 0) break;
                    data[pos] = current;
                    pos = parent;
                }

                data[pos] = item;
            },

            _down: function (pos) {
                var data = this.data;
                var compare = this.compare;
                var halfLength = this.length >> 1;
                var item = data[pos];

                while (pos < halfLength) {
                    var left = (pos << 1) + 1;
                    var right = left + 1;
                    var best = data[left];

                    if (right < this.length && compare(data[right], best) < 0) {
                        left = right;
                        best = data[right];
                    }
                    if (compare(best, item) >= 0) break;

                    data[pos] = best;
                    pos = left;
                }

                data[pos] = item;
            }
        };

        if (polygon.length === 3) {
            return getCentroidOfPolygon(polygon);
        }

        var precision = 0.01;
        polygon = [polygon];

        // find the bounding box of the outer ring
        var minX, minY, maxX, maxY;
        for (var i = 0; i < polygon[0].length; i++) {
            var p = polygon[0][i];
            if (!i || p.x < minX) minX = p.x;
            if (!i || p.y < minY) minY = p.y;
            if (!i || p.x > maxX) maxX = p.x;
            if (!i || p.y > maxY) maxY = p.y;
        }

        var width = maxX - minX;
        var height = maxY - minY;
        var cellSize = Math.min(width, height);
        var h = cellSize / 2;

        // a priority queue of cells in order of their "potential" (max distance to polygon)
        var cellQueue = new TinyQueue(null, compareMax);

        if (cellSize === 0) return [minX, minY];

        // cover polygon with initial cells
        for (var x = minX; x < maxX; x += cellSize) {
            for (var y = minY; y < maxY; y += cellSize) {
                cellQueue.push(new Cell(x + h, y + h, h, polygon));
            }
        }

        // take centroid as the first best guess
        var bestCell = getCentroidCell(polygon);

        // special case for rectangular polygons
        var bboxCell = new Cell(minX + width / 2, minY + height / 2, 0, polygon);
        if (bboxCell.d > bestCell.d) bestCell = bboxCell;

        while (cellQueue.length) {
            // pick the most promising cell from the queue
            var cell = cellQueue.pop();

            // update the best cell if we found a better one
            if (cell.d > bestCell.d) {
                bestCell = cell;
            }

            // do not drill down further if there's no chance of a better solution
            if (cell.max - bestCell.d <= precision) continue;

            // split the cell into four cells
            h = cell.h / 2;
            cellQueue.push(new Cell(cell.x - h, cell.y - h, h, polygon));
            cellQueue.push(new Cell(cell.x + h, cell.y - h, h, polygon));
            cellQueue.push(new Cell(cell.x - h, cell.y + h, h, polygon));
            cellQueue.push(new Cell(cell.x + h, cell.y + h, h, polygon));
        }

        return {x:bestCell.x, y:bestCell.y};
    };
