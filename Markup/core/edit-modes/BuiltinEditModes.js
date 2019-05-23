
import { theEditModeManager } from '../EditModeManager'
import * as MarkupTypes from '../MarkupTypes'

import { EditModeArrow } from './EditModeArrow'
import { EditModeText } from './EditModeText'
import { EditModeRectangle } from './EditModeRectangle'
import { EditModeCircle } from './EditModeCircle'
import { EditModeCloud } from './EditModeCloud'
import { EditModeFreehand } from './EditModeFreehand'
import { EditModeHighlight } from './EditModeHighlight'
import { EditModePolyline } from './EditModePolyline'
import { EditModePolycloud } from './EditModePolycloud'
import { EditModeCallout } from './EditModeCallout'
import { EditModeDimension } from './EditModeDimension'


theEditModeManager.register(MarkupTypes.MARKUP_TYPE_ARROW, EditModeArrow);
theEditModeManager.register(MarkupTypes.MARKUP_TYPE_TEXT, EditModeText);
theEditModeManager.register(MarkupTypes.MARKUP_TYPE_RECTANGLE, EditModeRectangle);
theEditModeManager.register(MarkupTypes.MARKUP_TYPE_CIRCLE, EditModeCircle);
theEditModeManager.register(MarkupTypes.MARKUP_TYPE_CLOUD, EditModeCloud);
theEditModeManager.register(MarkupTypes.MARKUP_TYPE_FREEHAND, EditModeFreehand);
theEditModeManager.register(MarkupTypes.MARKUP_TYPE_HIGHLIGHT, EditModeHighlight);
theEditModeManager.register(MarkupTypes.MARKUP_TYPE_POLYLINE, EditModePolyline);
theEditModeManager.register(MarkupTypes.MARKUP_TYPE_POLYCLOUD, EditModePolycloud);
theEditModeManager.register(MarkupTypes.MARKUP_TYPE_CALLOUT, EditModeCallout);
theEditModeManager.register(MarkupTypes.MARKUP_TYPE_DIMENSION, EditModeDimension);

