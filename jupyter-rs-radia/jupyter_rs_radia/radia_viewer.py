from __future__ import absolute_import, division, print_function

import datetime
import ipywidgets as widgets
import radia

from jupyter_rs_radia import radia_tk
from jupyter_rs_vtk import gui_utils
from jupyter_rs_vtk import vtk_viewer
from pykern.pkcollections import PKDict
from pykern.pkdebug import pkdp, pkdlog
from jupyter_rs_vtk import rs_utils
from traitlets import Any, Dict, Instance, List, Unicode

FIELD_TYPE_MAG_M = 'M'
FIELD_TYPE_MAG_B = 'B'
FIELD_TYPES = [FIELD_TYPE_MAG_M, FIELD_TYPE_MAG_B]

VIEW_TYPE_OBJ = 'Objects'
VIEW_TYPE_FIELD = 'Fields'
VIEW_TYPES = [VIEW_TYPE_OBJ, VIEW_TYPE_FIELD]


def _label_grp(widget, txt, layout={'padding': '0 6px 0 0'}):
    return widgets.HBox(
        [widgets.Label(txt), widget],
        layout=layout
    )


@widgets.register
class RadiaViewer(widgets.VBox, rs_utils.RSDebugger):
    """Radia interface"""
    _view_name = Unicode('RadiaViewerView').tag(sync=True)
    _model_name = Unicode('RadiaViewerModel').tag(sync=True)
    _view_module = Unicode('jupyter-rs-radia').tag(sync=True)
    _model_module = Unicode('jupyter-rs-radia').tag(sync=True)
    _view_module_version = Unicode('^0.0.1').tag(sync=True)
    _model_module_version = Unicode('^0.0.1').tag(sync=True)

    _axes = ['x', 'y', 'z']
    _is_displayed = False

    current_geom = Unicode('').tag(sync=True)
    current_field_points = [[0.0, 0.0, 0.0]]

    field_color_map_name = Unicode('').tag(sync=True)

    client_props = Dict(default_value={}).tag(sync=True)
    client_prop_map = PKDict(
        field_color_maps=PKDict(obj='field_color_map_list', attr='options'),
        field_color_map_name=PKDict(obj='field_color_map_list', attr='value'),
        vector_scaling_types=PKDict(obj='vector_scaling_list', attr='options'),
        vector_scaling=PKDict(obj='vector_scaling_list', attr='value'),
    )

    field_color_maps = List(default_value=list()).tag(sync=True)
    # use "model_info"?  So we don't have "model_data.data"
    model_data = Dict(default_value={}).tag(sync=True)
    title = Unicode('').tag(sync=True)
    vector_scaling = Unicode('').tag(sync=True)
    vector_scaling_types = List(default_value=list()).tag(sync=True)
    vtk_viewer = None

    def add_geometry(self, geom_name, geom):
        self.mgr.add_geom(geom_name, geom)
        self.geom_list.options = [n for n in self.mgr.get_geoms()]

    # 'API' calls should support 'command line' style of invocation, and not
    # rely solely on current widget settings
    def display(self, g_name=None, v_type=None, f_type=None):
        self._update_layout()
        if g_name is None:
            g_name = self.current_geom
        self.current_geom = g_name
        v_type = self.view_type_list.value if v_type is None else v_type
        f_type = self.field_type_list.value if f_type is None else f_type
        #self.rsdbg('Display g {} view {} field {}'.format(g_name, v_type, f_type))
        if v_type not in VIEW_TYPES:
            raise ValueError('Invalid view {} ({})'.format(v_type, VIEW_TYPES))
        if f_type not in FIELD_TYPES:
            raise ValueError('Invalid field {} ({})'.format(f_type, FIELD_TYPES))
        if v_type == VIEW_TYPE_OBJ:
            self.model_data = self.mgr.geom_to_data(g_name)
        elif v_type == VIEW_TYPE_FIELD:
            if f_type == FIELD_TYPE_MAG_M:
                self.model_data = self.mgr.magnetization_to_data(g_name)
            elif f_type == FIELD_TYPE_MAG_B:
                self.model_data = self.mgr.mag_field_to_data(
                    g_name,
                    self._get_current_field_points()
                )
        #self.rsdbg('setting vtk data {} for {}'.format(self.model_data, self.current_geom))
        self.vtk_viewer.set_data(self.model_data)
        self.refresh()
        return self

    def refresh(self):
        self._set_title()
        self.send({'type': 'refresh'})

    def __init__(self, mgr=None):
        self.model_data = {}
        self.mgr = radia_tk.RadiaGeomMgr() if mgr is None else mgr
        self.on_displayed(self._radia_displayed)
        self.vtk_viewer = vtk_viewer.Viewer()

        self.view_type_list = widgets.Dropdown(
            layout={'width': 'max-content'},
            options=VIEW_TYPES,
        )
        self.view_type_list.observe(self._update_viewer, names='value')
        view_type_list_grp = _label_grp(self.view_type_list, 'View')

        self.field_type_list = widgets.Dropdown(
            layout={'width': 'max-content'},
            options=FIELD_TYPES,
        )
        self.field_type_list.observe(self._update_viewer, names='value')
        field_type_list_grp = _label_grp(self.field_type_list, 'Field')

        self.geom_list = widgets.Dropdown(
            layout={'width': 'max-content'},
            options=[n for n in self.mgr.get_geoms()]
        )
        self.geom_list.observe(self._set_current_geom, names='value')
        geom_list_grp = _label_grp(self.geom_list, 'Geometry')

        # TODO(mvk): from schema
        self.field_color_map_list = widgets.Dropdown(
            layout={'width': 'max-content'},
        )

        # the options/value of a dropdown are not syncable!  We'll work around it
        self.field_color_map_list.observe(self._set_field_color_map, names='value')
        field_map_grp = _label_grp(self.field_color_map_list, 'Color Map')
        field_map_grp.layout = widgets.Layout(padding='0 6px 0 0')

        self.vector_scaling_list = widgets.Dropdown(
            layout={'width': 'max-content'},
        )
        self.vector_scaling_list.observe(self._set_vector_scaling, names='value')
        vector_scaling_grp = _label_grp(self.vector_scaling_list, 'Scaling')

        self.new_field_pt_flds = PKDict()
        for axis in RadiaViewer._axes:
            self.new_field_pt_flds[axis] = widgets.FloatText(
                    value=0.0, layout={'width': '48px'},
                )

        new_field_point_coords_grp = widgets.HBox(
            [_label_grp(self.new_field_pt_flds[axis], axis) for
             axis in self.new_field_pt_flds]
        )

        self.new_field_point_btn = widgets.Button(
            description='+', layout={'width': 'fit-content'},
        )
        self.new_field_point_btn.on_click(self._add_field_point)

        self.new_field_point_grp = widgets.HBox([
            new_field_point_coords_grp, self.new_field_point_btn
        ], layout={'padding': '0 6px 0 0'})

        # new plus existing
        self.field_point_grp  = widgets.HBox([
        ])

        self.vector_grp = widgets.HBox([
            field_type_list_grp,
            self.new_field_point_grp,
            field_map_grp,
            vector_scaling_grp
        ])

        geom_grp = widgets.HBox([
            geom_list_grp,
            view_type_list_grp,
            self.vector_grp
        ], layout={'padding': '3px 0px 3px 0px'})

        self.solve_prec = widgets.BoundedFloatText(
            value=0.0001, min=1e-06, max=10.0, step=1e-06,
            layout={'width': '72px'},
        )
        solve_prec_grp = _label_grp(
            self.solve_prec,
            'Precision (' + radia_tk.RadiaGeomMgr.m_field_units + ')'
        )

        self.solve_max_iter = widgets.BoundedIntText(
            value=1500, min=1, max=1e6, step=100,
            layout={'width': '72px'},
        )
        solve_max_iter_grp = _label_grp(self.solve_max_iter, 'Max Iterations')

        self.solve_method = widgets.Dropdown(
            layout={'width': 'max-content'},
            value=0,
            options=[('0', 0), ('3', 3), ('4', 4), ('5', 5)]
        )
        solve_method_grp = _label_grp(self.solve_method, 'Method', layout={})
        self.solve_btn = widgets.Button(description='Solve',
                                        layout={'width': 'fit-content'},
                                        )
        self.solve_btn.on_click(self._solve)

        self.solve_res_label = widgets.Label()

        solve_grp = widgets.HBox([
            solve_prec_grp,
            solve_max_iter_grp,
            solve_method_grp,
            self.solve_btn,
            self.solve_res_label
        ], layout={'padding': '3px 0px 3px 0px'})

        # for enabling/disabling as a whole
        self.controls = [
            self.field_color_map_list,
            self.new_field_point_btn,
            self.field_type_list,
            self.solve_btn,
            self.solve_method,
            self.solve_max_iter,
            self.solve_prec,
            self.vector_scaling_list,
            self.view_type_list,
        ]

        controls_grp = widgets.VBox(
            [geom_grp, solve_grp],
            layout={'padding': '8px 4px 4px 4px'}
        )

        self.observe(self._set_client_props, names='client_props')
        super(RadiaViewer, self).__init__(children=[
            self.vtk_viewer,
            geom_grp,
            solve_grp,
        ])

    def _add_field_point(self, b):
        new_pt = [self.new_field_pt_flds[f].value for f in self.new_field_pt_flds]
        if any([new_pt[0] == p[0] and new_pt[1] == p[1] and new_pt[2] == p[2]
                for p in self.current_field_points]):
            self.rsdbg('Point {} exists'.format(new_pt))
            return
        self.current_field_points.append(new_pt)
        self.display()

    def _enable_controls(self, enabled):
        for c in self.controls:
            c.disabled = not enabled

    def _get_current_field_points(self):
        return [item for sublist in self.current_field_points for item in sublist]

    def _radia_displayed(self, o):
        self.geom_list.value = self.current_geom

    def _remove_field_point(self, p_idx):
        pass

    def _set_current_geom(self, d):
        g_name = d['new']
        self.current_geom = g_name
        self.display(g_name)

    def _set_client_props(self, d):
        self.client_props = d['new']
        for pn in self.client_prop_map:
            p = self.client_prop_map[pn]
            setattr(getattr(self, p.obj), p.attr, self.client_props[pn])

    def _set_field_color_map(self, d):
        self.field_color_map_name = d['new']
        self.vtk_viewer.content.vector_color_map_name = self.field_color_map_name

    def _set_title(self):
        f = '' if self.view_type_list.value == 'Objects' \
            else self.field_type_list.value + ' '
        self.title = '{} ({}{})'.format(self.current_geom, f, self.view_type_list.value)

    def _set_vector_scaling(self, d):
        self.vector_scaling = d['new']

    def _solve(self, b):
        #self.rsdbg('solve prec {} iter {} meth {}'.format(
        #    self.solve_prec.value, self.solve_max_iter.value, self.solve_method.value
        #))
        self._enable_controls(False)
        self.solve_res_label.value = ''
        start = datetime.datetime.now()
        res = radia.Solve(
            self.mgr.get_geom(self.current_geom),
            self.solve_prec.value,
            self.solve_max_iter.value,
            self.solve_method.value
        )
        stop = datetime.datetime.now()
        self.display()
        self._enable_controls(True)
        d = stop - start
        self.solve_res_label.value = '{} ({}.{:06}s)'.format(
            'Done', d.seconds, d.microseconds
        )

    # show/hide/enable/disable controls based on current state
    def _update_layout(self):
        self.vector_grp.layout.display = \
            None if self.view_type_list.value == VIEW_TYPE_FIELD else 'none'
        self.field_type_list.layout.display =\
            None if self.view_type_list.value == VIEW_TYPE_FIELD else 'none'
        self.new_field_point_grp.layout.display =\
            None if self.field_type_list.value == FIELD_TYPE_MAG_B else 'none'

    def _update_viewer(self, d):
        self.display(self.current_geom)

