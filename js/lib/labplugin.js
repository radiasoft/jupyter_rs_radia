import {RadiaViewerModel, RadiaViewerView, version} from './index'
import {IJupyterWidgetRegistry} from '@jupyter-widgets/base';

export const radiaWidgetPlugin = {
  id: 'jupyter_rs_radia',
  requires: [IJupyterWidgetRegistry],
  activate: function(app, widgets) {
      widgets.registerWidget({
          name: 'jupyter_rs_radia',
          version: version,
          exports: { RadiaViewerModel, RadiaViewerView },
      });
  },
  autoStart: true
};

export default radiaWidgetPlugin;
