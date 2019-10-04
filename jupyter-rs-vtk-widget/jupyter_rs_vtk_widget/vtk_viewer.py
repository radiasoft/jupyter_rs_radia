import ipywidgets as widgets
import traitlets

from traitlets import Dict, Unicode

@widgets.register
class VTK(widgets.DOMWidget):
    """VTK viewer"""
    _view_name = Unicode('VTKView').tag(sync=True)
    _model_name = Unicode('VTKModel').tag(sync=True)
    _view_module = Unicode('jupyter-rs-vtk-widget').tag(sync=True)
    _model_module = Unicode('jupyter-rs-vtk-widget').tag(sync=True)
    _view_module_version = Unicode('^0.0.1').tag(sync=True)
    _model_module_version = Unicode('^0.0.1').tag(sync=True)
    model_data = Dict({}).tag(sync=True)

    reset_button = widgets.Button(description='Reset')

    @traitlets.default('layout')
    def _default_layout(self):
        return widgets.Layout(height='400px', align_self='stretch')

