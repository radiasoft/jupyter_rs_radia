import ipywidgets as widgets
import ipywidgets.widgets.trait_types as trait_types
import traitlets

from traitlets import Any, Dict, Instance, List, Unicode


@widgets.register
class VTK(widgets.DOMWidget):
    """VTK content"""
    _view_name = Unicode('VTKView').tag(sync=True)
    _model_name = Unicode('VTKModel').tag(sync=True)
    _view_module = Unicode('jupyter-rs-vtk-widget').tag(sync=True)
    _model_module = Unicode('jupyter-rs-vtk-widget').tag(sync=True)
    _view_module_version = Unicode('^0.0.1').tag(sync=True)
    _model_module_version = Unicode('^0.0.1').tag(sync=True)
    model_data = Dict({}).tag(sync=True)
    #@traitlets.default('layout')
    #def _default_layout(self):
    #    return widgets.Layout(align_self='stretch')

    def __init__(self):
        self.model_data = {}
        super(VTK, self).__init__()



@widgets.register
class Viewer(widgets.VBox):
    """VTK viewer"""
    #_model_name = Unicode('ViewerModel').tag(sync=True)
    #_view_name = Unicode('ViewerView').tag(sync=True)
    #_model_name = Unicode('VBoxModel').tag(sync=True)
    #_view_name = Unicode('VBoxView').tag(sync=True)
    #_model_module = Unicode('jupyter-rs-vtk-widget').tag(sync=True)
    #_view_module = Unicode('jupyter-rs-vtk-widget').tag(sync=True)
    #_model_module_version = Unicode('^0.0.1').tag(sync=True)
    #_view_module_version = Unicode('^0.0.1').tag(sync=True)
    #content = VTK()
    model_data = Dict({}).tag(sync=True)
    #reset_button = widgets.Button(description='Reset')
    #buttons = widgets.HBox([reset_button])
    #children = (buttons,)

    @traitlets.default('layout')
    def _default_layout(self):
        return widgets.Layout(align_self='stretch')

    def __init__(self):
        self.content = VTK()
        self.reset_button = widgets.Button(description='Reset')
        self.buttons = widgets.HBox([self.reset_button])
        self.children = [self.content, self.buttons]
        super(Viewer, self).__init__(children=[self.content, self.buttons])
        #super(Viewer, self).__init__(
        #    children=(widgets.HBox([widgets.Button(description='Reset')]), )
        #)

