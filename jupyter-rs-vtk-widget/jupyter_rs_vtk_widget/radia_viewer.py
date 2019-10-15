import ipywidgets as widgets
import radia as rad
import traitlets

from traitlets import Any, Dict, Instance, List, Unicode

@widgets.register
class RadiaViewer(widgets.VBox):
    """Radia interface"""
    _view_name = Unicode('RadiaViewerView').tag(sync=True)
    _model_name = Unicode('RadiaViewerModel').tag(sync=True)
    _view_module = Unicode('jupyter-rs-vtk-widget').tag(sync=True)
    _model_module = Unicode('jupyter-rs-vtk-widget').tag(sync=True)
    _view_module_version = Unicode('^0.0.1').tag(sync=True)
    _model_module_version = Unicode('^0.0.1').tag(sync=True)

    def _radia_displayed(self, o):
        pass

    def __init__(self, data=None, mgr=None):
        self.model_data = {} if data is None else data
        self.mgr = RadiaGeomMgr() if mgr is None else mgr
        self.on_displayed(self._radia_displayed)
        #self.vtk_viewer
        super(RadiaViewer, self).__init__()


class RadiaGeomMgr():
    """Manager for multiple geometries"""

    def add_geom(self, geom, geom_name):
        self._geoms[geom_name] = geom

    def get_geom(self, name):
        return self._geoms[name]

    def get_geom_list(self):
        return [n for n in self._geoms]

    def get_geoms(self):
        return self._geoms

    def to_data(self, name):
        g = self.get_geom(name)
        if not g:
            raise ValueError('No such geometry {}'.format(name))
        return rad.ObjGeometry(g)

        return

    def __init__(self):
        self._geoms = {}
