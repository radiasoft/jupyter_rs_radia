from ._version import NPM_PACKAGE_RANGE
from jupyter_rs_radia import radia_tk
from jupyter_rs_vtk import vtk_viewer
from pykern import pkdebug
from pykern import pkio
from pykern import pkjson
from pykern import pkresource
from pykern.pkcollections import PKDict
from traitlets import Dict, List, Unicode
import datetime
import ipywidgets
import math
import radia

AXES = ["x", "y", "z"]

PATH_TYPE_CIRCLE = "Circle"
PATH_TYPE_FILE = "File"
PATH_TYPE_LINE = "Line"
PATH_TYPE_MANUAL = "Manual"
PATH_TYPES = [PATH_TYPE_LINE, PATH_TYPE_CIRCLE, PATH_TYPE_MANUAL, PATH_TYPE_FILE]

VIEW_TYPE_OBJ = "Objects"
VIEW_TYPE_FIELD = "Fields"
VIEW_TYPES = [VIEW_TYPE_OBJ, VIEW_TYPE_FIELD]


# TODO(mvk): move to common widget toolbox
def _coord_grp(coords, layout={"width": "48px"}):
    flds = PKDict()
    for ax_idx, axis in enumerate(AXES):
        flds[axis] = ipywidgets.FloatText(
            value=coords[ax_idx],
            layout=layout,
        )
    grp = ipywidgets.HBox([_label_grp(flds[axis], axis) for axis in flds])
    return flds, grp


def _label_grp(widget, txt, layout={"padding": "0 6px 0 0"}):
    return ipywidgets.HBox([ipywidgets.Label(txt), widget], layout=layout)


@ipywidgets.register
class RadiaViewer(ipywidgets.VBox):
    """Jupyter widget for visualizing 3D Radia models.

    RadiaViewer allows users to render a magnet geometry and solve for its fields
    in a self-contained widget. The rendering is done by the VTK.js library.
    """

    _view_name = Unicode("RadiaViewerView").tag(sync=True)
    _model_name = Unicode("RadiaViewerModel").tag(sync=True)
    _view_module = Unicode("jupyter_rs_radia").tag(sync=True)
    _model_module = Unicode("jupyter_rs_radia").tag(sync=True)
    _view_module_version = Unicode(NPM_PACKAGE_RANGE).tag(sync=True)
    _model_module_version = Unicode(NPM_PACKAGE_RANGE).tag(sync=True)

    current_geom = Unicode("").tag(sync=True)
    current_field_points = []

    field_color_map_name = Unicode("").tag(sync=True)

    file_data = List(default_value=()).tag(sync=True)

    client_props = Dict(default_value={}).tag(sync=True)
    client_prop_map = PKDict(
        field_color_maps=PKDict(obj="field_color_map_list", attr="options"),
        field_color_map_name=PKDict(obj="field_color_map_list", attr="value"),
        vector_scaling_types=PKDict(obj="vector_scaling_list", attr="options"),
        vector_scaling=PKDict(obj="vector_scaling_list", attr="value"),
    )

    field_color_maps = List(default_value=list()).tag(sync=True)
    # use "model_info"?  So we don't have "model_data.data"
    model_data = Dict(default_value={}).tag(sync=True)
    out = ipywidgets.Output(layout={"border": "1px solid black"})

    # sync with js?
    solve_results = None

    title = Unicode("").tag(sync=True)
    vector_scaling = Unicode("").tag(sync=True)
    vector_scaling_types = List(default_value=list()).tag(sync=True)
    vtk_viewer = None

    def add_geometry(self, g_name, geom):
        """Adds a Radia geometry to the viewer.

        Args:
            g_name (str): a suitable name for this geometry
            geom (int): the reference to the geometry
        """
        self.mgr.add_geom(g_name, geom)
        self.geom_list.options = [n for n in self.mgr.get_geoms()]

    # 'API' calls should support 'command line' style of invocation, and not
    # rely solely on current widget settings
    def display(self, g_name=None, v_type=None, f_type=None, p_type=None):
        """Shows the selected geometry or its associated fields.

        All args are optional; when they are omitted, the viewer will use the
        values set in the GUI.

        Args:
            g_name (str, optional): name of a geometry
            v_type (str optional): view type, one of 'Objects' or 'Fields'
            f_type (str optional): field type, one of:
                'M' (magnetization)
                'B' (magnetic field)
                'A' (vector potential)
                'H' (magnetic field strength)
                'J' (current density)
            p_type (str optional): path type, one of:
                'Line'
                'Circle'
                'Manual'
                'File'
        Returns:
            Widget: the viewer instance if successful,
            else an Output widget containing an error message
        Raises:
            KeyError: if no geometry named <g_name> has been added
            ValueError: if v_type, f_type, or p_type are invalid
        """
        self.out.clear_output()
        self._update_layout()
        self._update_actions()
        self.solve_results = None
        if g_name is None:
            g_name = self.current_geom
        self.current_geom = g_name
        v_type = self.view_type_list.value if v_type is None else v_type
        f_type = self.field_type_list.value if f_type is None else f_type
        p_type = self.path_type_list.value if p_type is None else p_type

        # return the Output widget by itself when raising errors here
        if v_type not in VIEW_TYPES:
            self._do_raise(
                ValueError("Invalid view {} ({})".format(v_type, VIEW_TYPES))
            )
            # self.rserr('Invalid view {} ({})'.format(v_type, VIEW_TYPES))
            return self.out
        if f_type not in radia_tk.FIELD_TYPES:
            self._do_raise(
                ValueError("Invalid field {} ({})".format(f_type, radia_tk.FIELD_TYPES))
            )
            # self.rserr('Invalid field {} ({})'.format(f_type, radia_tk.FIELD_TYPES))
            return self.out
        if p_type not in PATH_TYPES:
            self._do_raise(
                ValueError("Invalid path {} ({})".format(p_type, PATH_TYPES))
            )
            # self.rserr('Invalid path {} ({})'.format(p_type, PATH_TYPES))
            return self.out
        if v_type == VIEW_TYPE_OBJ:
            self.model_data = self.mgr.geom_to_data(g_name)
        elif v_type == VIEW_TYPE_FIELD:
            if f_type == radia_tk.FIELD_TYPE_MAG_M:
                self.solve_results = self.mgr.get_magnetization(g_name)
            elif f_type in radia_tk.POINT_FIELD_TYPES:
                self.solve_results = self.mgr.get_field(
                    g_name, f_type, self.get_field_points()
                )
            self.model_data = self.mgr.vector_field_to_data(
                g_name, self.solve_results, radia_tk.FIELD_UNITS[f_type]
            )

        self.vtk_viewer.set_data(self.model_data)
        self._refresh()
        return self

    def get_field_points(self):
        """
        Returns:
            list: the points where the field is being evaluated, or None
            if the view type is 'Objects' or the field type is 'M'.
            The list is flattened (x0, y0, y1,...)
            to use as input to Radia.Fld()
        """
        try:
            # flatten
            return [item for sublist in self.current_field_points for item in sublist]
        except TypeError:
            # already flattened, as from a file
            return self.current_field_points

    def get_result(self):
        """
        Returns:
            list: the field points and the value of the field thereat.
            (((x0, y0, z0), (fx0, fy0, fz0)),...)
        """
        return self.solve_results

    def rsdbg(self, msg):
        # send a message to the front end to print to js console
        self.send({"type": "debug", "msg": "KERNEL: " + msg})

    @out.capture(clear_output=True)
    def rserr(self, msg):
        # send an error message to the front end to print to js console
        self.send({"type": "error", "msg": "KERNEL: " + msg})

        # in addition, this will show up in the notebook
        pkdebug.pkdlog(msg)

    def __init__(self, mgr=None):
        self.model_data = {}
        self.mgr = radia_tk.RadiaGeomMgr() if mgr is None else mgr
        self.on_displayed(self._radia_displayed)
        self.vtk_viewer = vtk_viewer.Viewer()

        # TODO(mvk): build view from this schema
        self.schema = pkjson.load_any(
            pkio.py_path(pkresource.filename("schema.json")),
        )

        self.view_type_list = ipywidgets.Dropdown(
            layout={"width": "max-content"},
            options=VIEW_TYPES,
        )
        self.view_type_list.observe(self._update_viewer, names="value")
        view_type_list_grp = _label_grp(self.view_type_list, "View")

        self.field_type_list = ipywidgets.Dropdown(
            layout={"width": "max-content"},
            options=radia_tk.FIELD_TYPES,
        )
        self.field_type_list.observe(self._update_viewer, names="value")
        field_type_list_grp = _label_grp(self.field_type_list, "Field")

        self.path_type_list = ipywidgets.Dropdown(
            layout={"width": "max-content"},
            options=PATH_TYPES,
        )
        self.path_type_list.observe(self._update_viewer, names="value")
        self.path_type_list_grp = _label_grp(self.path_type_list, "Path")

        # behavior changes depending on path type chosen
        self.new_field_point_btn = ipywidgets.Button(
            description="+",
            layout={"width": "fit-content"},
        )
        self.new_field_point_btn.on_click(self._add_field_point)

        self.line_begin_pt_flds, line_begin_point_coords_grp = _coord_grp(
            [-10, 0, 0], {"width": "64px"}
        )
        line_begin_grp = _label_grp(line_begin_point_coords_grp, "Begin")
        self.line_end_pt_flds, line_end_point_coords_grp = _coord_grp(
            [10, 0, 0], {"width": "64px"}
        )
        line_end_grp = _label_grp(line_end_point_coords_grp, "End")
        self.path_num_pts = ipywidgets.IntText(
            value=10, min=2, max=100, step=1, layout={"width": "48px"}
        )

        num_pts_grp = _label_grp(self.path_num_pts, "Num Points")
        self.line_grp = ipywidgets.HBox(
            [line_begin_grp, line_end_grp, num_pts_grp, self.new_field_point_btn],
            layout={"padding": "0 6px 0 0"},
        )

        self.circle_ctr_flds, circle_ctr_coords_grp = _coord_grp(
            [0, 0, 0], {"width": "64px"}
        )
        circle_ctr_grp = _label_grp(circle_ctr_coords_grp, "Center")

        self.circle_radius = ipywidgets.BoundedFloatText(
            min=0.1, max=1000, value=10.0, layout={"width": "48px"}
        )
        circle_radius_grp = _label_grp(self.circle_radius, "Radius")

        self.circle_theta = ipywidgets.BoundedFloatText(
            min=-math.pi, max=math.pi, step=0.1, value=0.0, layout={"width": "48px"}
        )
        circle_theta_grp = _label_grp(self.circle_theta, "𝞱")

        self.circle_phi = ipywidgets.BoundedFloatText(
            min=-math.pi, max=math.pi, step=0.1, value=0.0, layout={"width": "48px"}
        )
        circle_phi_grp = _label_grp(self.circle_phi, "𝞿")

        self.circle_grp = ipywidgets.HBox(
            [
                circle_ctr_grp,
                circle_radius_grp,
                circle_theta_grp,
                circle_phi_grp,
                num_pts_grp,
                self.new_field_point_btn,
            ],
            layout={"padding": "0 6px 0 0"},
        )

        # self.pt_file_btn = ipywidgets.FileUpload()
        self.pt_file_btn = ipywidgets.Button(
            description="Choose", layout={"width": "fit-content"}
        )
        self.pt_file_btn.on_click(self._upload)
        self.pt_file_label = ipywidgets.Label("<None>")
        self.pt_file_label.add_class("rs-file-input-label")
        self.observe(self._data_loaded, names="file_data")
        self.pt_file_grp = ipywidgets.HBox(
            [self.pt_file_btn, self.pt_file_label, self.new_field_point_btn],
            layout={"padding": "0 6px 0 0"},
        )

        self.geom_list = ipywidgets.Dropdown(
            layout={"width": "max-content"}, options=[n for n in self.mgr.get_geoms()]
        )
        self.geom_list.observe(self._set_current_geom, names="value")
        geom_list_grp = _label_grp(self.geom_list, "Geometry")

        self.field_color_map_list = ipywidgets.Dropdown(
            layout={"width": "max-content"},
        )

        # the options/value of a dropdown are not syncable!  We'll work around it
        self.field_color_map_list.observe(self._set_field_color_map, names="value")
        field_map_grp = _label_grp(self.field_color_map_list, "Color Map")
        field_map_grp.layout = ipywidgets.Layout(padding="0 6px 0 0")

        self.vector_scaling_list = ipywidgets.Dropdown(
            layout={"width": "max-content"},
        )
        self.vector_scaling_list.observe(self._set_vector_scaling, names="value")
        vector_scaling_grp = _label_grp(self.vector_scaling_list, "Scaling")

        self.new_field_pt_flds, new_field_point_coords_grp = _coord_grp([0, 0, 0])
        self.new_field_point_grp = ipywidgets.HBox(
            [new_field_point_coords_grp, self.new_field_point_btn],
            layout={"padding": "0 6px 0 0"},
        )
        self.new_field_point_btn_actions = [
            self._add_field_point,
            self._add_field_line,
            self._add_field_circle,
            self._add_field_file,
        ]

        self.vector_props_grp = ipywidgets.HBox([field_map_grp, vector_scaling_grp])

        self.vector_grp = ipywidgets.HBox(
            [
                field_type_list_grp,
                self.path_type_list_grp,
                self.line_grp,
                self.circle_grp,
                self.new_field_point_grp,
                self.pt_file_grp,
            ]
        )

        geom_grp = ipywidgets.HBox(
            [geom_list_grp, view_type_list_grp, self.vector_props_grp],
            layout={"padding": "3px 0px 3px 0px"},
        )

        self.solve_prec = ipywidgets.BoundedFloatText(
            value=0.0001,
            min=1e-06,
            max=10.0,
            step=1e-06,
            layout={"width": "72px"},
        )
        solve_prec_grp = _label_grp(
            self.solve_prec,
            "Precision (" + radia_tk.FIELD_UNITS[radia_tk.FIELD_TYPE_MAG_B] + ")",
        )

        self.solve_max_iter = ipywidgets.BoundedIntText(
            value=1500,
            min=1,
            max=1e6,
            step=100,
            layout={"width": "72px"},
        )
        solve_max_iter_grp = _label_grp(self.solve_max_iter, "Max Iterations")

        self.solve_method = ipywidgets.Dropdown(
            layout={"width": "max-content"},
            value=0,
            options=[("0", 0), ("3", 3), ("4", 4), ("5", 5)],
        )
        solve_method_grp = _label_grp(self.solve_method, "Method", layout={})
        self.solve_btn = ipywidgets.Button(
            description="Solve",
            layout={"width": "fit-content"},
        )
        self.solve_btn.on_click(self._solve)

        spnr = pkio.read_binary(pkresource.filename("sirepo_animated.gif"))
        self.solve_spinner = ipywidgets.Image(
            value=spnr, format="gif", width=24, height=24
        )
        self.solve_spinner.layout.display = "none"

        self.solve_res_label = ipywidgets.Label()

        # self.export_btn = ipywidgets.Button(
        #    description='Export',
        #    layout={'width': 'fit-content'},
        # )
        # self.export_btn.on_click(self._export)

        # self.export_link = ipywidgets.HTML(
        #    value='<a href="#" download="xxx">Export</a>'
        # )
        # self.export_link.add_class('radia-file-output')

        self.reset_btn = ipywidgets.Button(
            description="Reset",
            layout={"width": "fit-content"},
        )
        self.reset_btn.on_click(self._reset)

        solve_grp = ipywidgets.HBox(
            [
                solve_prec_grp,
                solve_max_iter_grp,
                solve_method_grp,
                self.solve_btn,
                self.solve_spinner,
                self.solve_res_label,
                # self.export_btn,
                # self.export_link
            ],
            layout={"padding": "3px 0px 3px 0px"},
        )

        # for enabling/disabling as a whole
        self.controls = [
            self.field_color_map_list,
            self.new_field_point_btn,
            self.field_type_list,
            self.path_type_list,
            self.solve_btn,
            self.solve_method,
            self.solve_max_iter,
            self.solve_prec,
            self.vector_scaling_list,
            self.view_type_list,
        ]

        controls_grp = ipywidgets.VBox(
            [geom_grp, solve_grp], layout={"padding": "8px 4px 4px 4px"}
        )

        self.observe(self._set_client_props, names="client_props")
        super(RadiaViewer, self).__init__(
            children=[self.vtk_viewer, geom_grp, self.vector_grp, solve_grp, self.out]
        )

    def _add_field_file(self, b):
        if len(self.file_data) % 3 != 0:
            # self._do_raise(ValueError('Invalid file data {}'.format(self.file_data)))
            self.rserr("Invalid file data {}".format(self.file_data))
            return
        self.current_field_points = self.file_data
        self.display()

    def _add_field_point(self, b):
        new_pt = [self.new_field_pt_flds[f].value for f in self.new_field_pt_flds]
        self.current_field_points.append(new_pt)
        self.display()

    def _add_field_line(self, b):
        p1 = [self.line_begin_pt_flds[f].value for f in self.line_begin_pt_flds]
        p2 = [self.line_end_pt_flds[f].value for f in self.line_end_pt_flds]
        self.current_field_points.append(p1)
        n = self.path_num_pts.value - 1
        for i in range(1, n):
            self.current_field_points.append(
                [p1[j] + i * (p2[j] - p1[j]) / n for j in range(len(p1))]
            )
        self.current_field_points.append(p2)
        self.display()

    def _add_field_circle(self, b):
        ctr = [self.circle_ctr_flds[f].value for f in self.circle_ctr_flds]
        r = float(self.circle_radius.value)
        # theta is a rotation about the x-axis
        th = float(self.circle_theta.value)
        # phi is a rotation about the z-axis
        phi = float(self.circle_phi.value)
        # self.rsdbg('adding circle at {} rad {} th {} phi {} ({})'.format(ctr, r, th, phi, self.path_num_pts.value))
        n = self.path_num_pts.value
        dpsi = 2.0 * math.pi / n
        # psi is the angle in the circle's plane
        for i in range(0, n):
            psi = i * dpsi
            # initial position of the point...
            # a = [r * math.sin(psi), r * math.cos(psi), 0]
            # ...rotate around x axis
            # a' = [
            #    a[0],
            #    a[1] * math.cos(th) - a[2] * math.sin(th),
            #    a[1] * math.sin(th) + a[2] * math.cos(th),
            # ]
            # ...rotate around z axis
            # a'' = [
            #    aa[0] * math.cos(phi) - aa[1] * math.cos(th),
            #    aa[0] * math.sin(phi) + aa[1] * math.cos(phi),
            #    aa[2]
            # ]
            # ...translate to final position
            # a''' = [
            #    ctr[0] + aaa[0],
            #    ctr[1] + aaa[1],
            #    ctr[2] + aaa[2],
            # ]
            # final position:
            self.current_field_points.append(
                [
                    r * math.sin(psi) * math.cos(phi)
                    - r * math.cos(psi) * math.cos(th) * math.sin(phi)
                    + ctr[0],
                    r * math.sin(psi) * math.sin(phi)
                    - r * math.cos(psi) * math.cos(th) * math.cos(phi)
                    + ctr[1],
                    r * math.cos(psi) * math.sin(th) + ctr[2],
                ]
            )
        self.display()

    def _data_loaded(self, d):
        # other stuff?  validate here?
        # self.rsdbg('DATA LOADED {}'.format(d['new']))
        self._enable_controls()

    def _disable_controls(self):
        for c in self.controls:
            c.disabled = True

    @out.capture(clear_output=True)
    def _do_raise(self, ex):
        raise ex

    def _enable_controls(self):
        for c in self.controls:
            c.disabled = False

    # def _export(self, b):
    #    self.rsdbg('EXPORT {}'.format(self.solve_results))
    #    self.send({'type': 'download'})

    def _radia_displayed(self, o):
        # self.rsdbg('_radia_displayed')
        self.geom_list.value = self.current_geom

    def _refresh(self):
        self._set_title()
        self.send({"type": "refresh"})

    def _remove_field_point(self, p_idx):
        pass

    def _reset(self):
        self.rsdbg("RESET")

    def _set_current_geom(self, d):
        g_name = d["new"]
        self.current_geom = g_name
        self.display(g_name)

    def _set_client_props(self, d):
        self.client_props = d["new"]
        for pn in self.client_prop_map:
            p = self.client_prop_map[pn]
            setattr(getattr(self, p.obj), p.attr, self.client_props[pn])

    def _set_field_color_map(self, d):
        self.field_color_map_name = d["new"]
        self.vtk_viewer.content.vector_color_map_name = self.field_color_map_name

    def _set_title(self):
        f = (
            ""
            if self.view_type_list.value == "Objects"
            else self.field_type_list.value + " "
        )
        self.title = "{} ({}{})".format(self.current_geom, f, self.view_type_list.value)

    def _set_vector_scaling(self, d):
        self.vector_scaling = d["new"]

    def _solve(self, b):
        self._disable_controls()
        self.solve_res_label.value = ""
        self.solve_spinner.layout.display = None
        start = datetime.datetime.now()
        # move all radia refs to tk?
        try:
            res = radia.Solve(
                self.mgr.get_geom(self.current_geom),
                self.solve_prec.value,
                self.solve_max_iter.value,
                self.solve_method.value,
            )
        except RuntimeError as ex:
            self.rserr("Solve failed: {}".format(ex))
            # self._do_raise(ex)
            return
        finally:
            self.solve_spinner.layout.display = "none"
            self._enable_controls()
        self.display()
        d = datetime.datetime.now() - start
        self.solve_res_label.value = (
            "Done {} steps ({}.{:06}s): Max |M| {:.4}A/m; Max |H| {:.4}A/m".format(
                int(res[3]), d.seconds, d.microseconds, res[1], res[2]
            )
        )

    # show/hide/enable/disable controls based on current state
    # TODO(mvk): getting unwieldy, time to refactor
    def _update_layout(self):
        self.vector_grp.layout.display = (
            None if self.view_type_list.value == VIEW_TYPE_FIELD else "none"
        )
        self.vector_props_grp.layout.display = (
            None if self.view_type_list.value == VIEW_TYPE_FIELD else "none"
        )
        self.field_type_list.layout.display = (
            None if self.view_type_list.value == VIEW_TYPE_FIELD else "none"
        )
        self.path_type_list_grp.layout.display = (
            None if self.field_type_list.value in radia_tk.POINT_FIELD_TYPES else "none"
        )
        self.line_grp.layout.display = (
            None
            if self.field_type_list.value in radia_tk.POINT_FIELD_TYPES
            and self.path_type_list.value == PATH_TYPE_LINE
            else "none"
        )
        self.circle_grp.layout.display = (
            None
            if self.field_type_list.value in radia_tk.POINT_FIELD_TYPES
            and self.path_type_list.value == PATH_TYPE_CIRCLE
            else "none"
        )
        self.new_field_point_grp.layout.display = (
            None
            if self.field_type_list.value in radia_tk.POINT_FIELD_TYPES
            and self.path_type_list.value == PATH_TYPE_MANUAL
            else "none"
        )
        self.pt_file_grp.layout.display = (
            None
            if self.field_type_list.value in radia_tk.POINT_FIELD_TYPES
            and self.path_type_list.value == PATH_TYPE_FILE
            else "none"
        )

    # change control behavior based on current state
    def _update_actions(self):
        # must remove all actions first - otherwise they all get called
        for a in self.new_field_point_btn_actions:
            self.new_field_point_btn.on_click(a, remove=True)
        if self.field_type_list.value in radia_tk.POINT_FIELD_TYPES:
            if self.path_type_list.value == PATH_TYPE_LINE:
                self.new_field_point_btn.on_click(self._add_field_line)
            if self.path_type_list.value == PATH_TYPE_CIRCLE:
                self.new_field_point_btn.on_click(self._add_field_circle)
            if self.path_type_list.value == PATH_TYPE_MANUAL:
                self.new_field_point_btn.on_click(self._add_field_point)
            if self.path_type_list.value == PATH_TYPE_FILE:
                self.new_field_point_btn.on_click(self._add_field_file)

    def _update_viewer(self, d):
        self.display(self.current_geom)

    def _upload(self, b):
        self.current_field_points.clear()
        # self._disable_controls()
        self.send({"type": "upload"})
