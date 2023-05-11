'use strict';

import { Markup } from './Markup';
import * as MarkupTypes from './MarkupTypes';
import { composeRGBAString, addMarkupMetadata,
    stringToSvgNode, createSvgElement} from './MarkupsCoreUtils';
import { cloneStyle, copyStyle, isStyleEqual } from './StyleUtils';
import { EditModeStamp } from './edit-modes/EditModeStamp';

export { MarkupStamp };

class MarkupStamp extends Markup {
    /** 
     * @param {number} id 
     * @param {Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore} editor 
     */
    constructor(id, editor, svgData) {
        const styleAttributes = [
            'text-data'
        ];
        super(id, editor, styleAttributes);
        this.type = MarkupTypes.MARKUP_TYPE_STAMP;
        this.addMarkupMetadata = addMarkupMetadata.bind(this);
    
        this.createShapeGroup();

        this.scriptSvgData = svgData;
        this.loadSvgData();
    
        this.bindDomEvents();
    }

    createShapeGroup() {
        /* 
        * shape
        *    group
        *      customSvg
        *    hitarea (aka markup)
        */
        this.shape = createSvgElement('g');
        this.shape.group = createSvgElement('g');
        this.shape.appendChild(this.shape.group);
        
        let hitarea = createSvgElement('path');
        hitarea.setAttribute('id', "hitarea");
        hitarea.setAttribute('fill', "none");
        this.shape.appendChild(hitarea);

        this.shape.hitarea = hitarea;
        this.shape.markup = hitarea;
    }

    loadSvgData() {
        let svgString = this.scriptSvgData || this.style['text-data'];
        let svgNode = stringToSvgNode(svgString);

        // null if parsing fails, so exit
        if (svgNode === null) {
            console.warn("SVG data " + svgString + " is invalid, skipping shape update");
            return;
        }

        let [width, height] = this.getDimensions(svgNode);

        // update the bounding box when the SVG is changed
        let path = `M 0 0 l ${width} 0 l 0 ${height} l ${-width} 0 z`;
        this.shape.hitarea.setAttribute('d', path);

        this.shape.group.innerHTML = svgNode.innerHTML;

        // This is to standardize things:
        // width and height are 1 unit
        // position is in the centre
        // have to flip things because of y axis going upwards
        this.shape.group.setAttribute('transform', `translate( -0.5 , 0.5 ) scale( ${1/width} , ${-1/height} )`);
        // then copy to the hitarea because it's outside the SVG
        this.shape.hitarea.setAttribute('transform', this.shape.group.getAttribute('transform'));
    }

    getEditMode() {
        return new EditModeStamp(this.editor);
    }

    set(position, size) {
        this.setSize(position, size.x, size.y);
        this.updateStyle();
    }

    updateStyle(styleChanged) {
        const strokeColor = this.highlighted ? this.highlightColor : composeRGBAString(this.style['stroke-color'], this.style['stroke-opacity']);
        this.shape.hitarea.setAttribute('stroke', strokeColor);

        // This only provides translation and rotation, not scale
        const transform = this.getTransform() + ` scale( ${this.size.x} , ${this.size.y} )`;
        this.shape.setAttribute('transform', transform);

        if (styleChanged) {
            this.loadSvgData();
        }
    }

    getDimensions(customSvg) {
        let vb = customSvg.getAttribute('viewBox');
        if (!vb) {
            // if no viewbox is specified, check for width and height
            let width = customSvg.getAttribute('width') || 100;
            let height = customSvg.getAttribute('height') || 100;
            return [width, height];
        }
        let strings = vb.split(' ');
        let width = parseInt(strings[2]);
        let height = parseInt(strings[3]);

        return [width, height];
    }

    setMetadata() {

        var metadata = cloneStyle(this.style);

        metadata.type = this.type;
        metadata.position = [this.position.x, this.position.y].join(" ");
        metadata.size = [this.size.x, this.size.y].join(" ");
        metadata.rotation = String(this.rotation);

        return this.addMarkupMetadata(this.shape, metadata);
    }

    setStyle(style) {
        let stylesEqual = isStyleEqual(style, this.style);
        if (!stylesEqual) {
            copyStyle(style, this.style);
        }

        this.updateStyle(!stylesEqual);
    }
}
