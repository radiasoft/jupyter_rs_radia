import numpy
import radia
import sys

from jupyter_rs_radia import rs_utils
from jupyter_rs_vtk import gui_utils
from numpy import linalg
from pykern.pkcollections import PKDict
from pykern.pkdebug import pkdp

FIELD_TYPE_MAG_A = 'A'
FIELD_TYPE_MAG_B = 'B'
FIELD_TYPE_MAG_H = 'H'
FIELD_TYPE_MAG_J = 'J'
FIELD_TYPE_MAG_M = 'M'
FIELD_TYPES = [FIELD_TYPE_MAG_M]
POINT_FIELD_TYPES = [
    FIELD_TYPE_MAG_B, FIELD_TYPE_MAG_A, FIELD_TYPE_MAG_H, FIELD_TYPE_MAG_J
]
FIELD_TYPES.extend(POINT_FIELD_TYPES)

# these might be available from radia
FIELD_UNITS = PKDict({
    FIELD_TYPE_MAG_A: 'T m',
    FIELD_TYPE_MAG_B: 'T',
    FIELD_TYPE_MAG_H: 'A/m',
    FIELD_TYPE_MAG_J: 'A/m^2',
    FIELD_TYPE_MAG_M: 'A/m',
})


class RadiaGeomMgr(rs_utils.RSDebugger):
    """Manager for multiple geometries (Radia objects)"""

    def _get_all_geom(self, geom):
        g_arr = []
        for g in radia.ObjCntStuf(geom):
            if len(radia.ObjCntStuf(g)) > 0:
                g_arr.extend(self._get_all_geom(g))
            else:
                g_arr.append(g)
        return g_arr

    def add_geom(self, name, geom):
        self._geoms[name] = PKDict(g=geom, solved=False)

    # path is *flattened* array of positions in space ([x1, y1, z1,...xn, yn, zn])
    def get_field(self, name, f_type, path):
        pv_arr = []
        p = numpy.reshape(path, (-1, 3)).tolist()
        b = []
        # get every component
        f = radia.Fld(self.get_geom(name), f_type, path)
        b.extend(f)
        b = numpy.reshape(b, (-1, 3)).tolist()
        for p_idx, pt in enumerate(p):
            pv_arr.append([pt, b[p_idx]])
        return pv_arr

    def get_magnetization(self, name):
        return radia.ObjM(self.get_geom(name))

    def is_geom_solved(self, name):
        return self.get_geom(name).solved

    # define send to satisfy RSDebugger - get web socket somehow instead?
    def send(self, msg):
        pkdp(msg)

    def vector_field_to_data(self, name, pv_arr, units):
        # format is [[[px, py, pz], [vx, vy, vx]], ...]
        # convert to webGL object

        v_data = gui_utils.new_geom_object()
        v_data.vectors.lengths = []
        v_data.vectors.colors = []
        v_max = 0.
        v_min = sys.float_info.max
        for i in range(len(pv_arr)):
            p = pv_arr[i][0]
            v = pv_arr[i][1]
            n = linalg.norm(v)
            v_max = max(v_max, n)
            v_min = min(v_min, n)
            nv = (numpy.array(v) / (n if n > 0 else 1.)).tolist()
            v_data.vectors.vertices.extend(p)
            v_data.vectors.directions.extend(nv)
            v_data.vectors.magnitudes.append(n)
        v_data.vectors.range = [v_min, v_max]
        v_data.vectors.units = units

        l_data = self.geom_to_data(name, divide=False).data[0]
        # temp color set - will move to client
        for c_idx, c in enumerate(l_data.lines.colors):
            l_data.lines.colors[c_idx] = 0.85
        v_data.lines.vertices.extend(l_data.lines.vertices)
        v_data.lines.lengths.extend(l_data.lines.lengths)
        v_data.lines.colors.extend(l_data.lines.colors)

        return PKDict(name=name + '.Field', id=self.get_geom(name), data=[v_data])

    def geom_to_data(self, name=None, divide=True):
        #TODO(mvk): if no color, get color from parent if any?
        g_id = self.get_geom(name)
        n = (name if name is not None else str(g_id)) + '.Geom'
        pd = PKDict(name=n, id=g_id, data=[])
        d = rs_utils.to_pkdict(radia.ObjDrwVTK(g_id, 'Axes->No'))
        n_verts = len(d.polygons.vertices)
        c = radia.ObjCntStuf(g_id)
        l = len(c)
        if not divide or l == 0:
            pd.data = [d]
        else:
            d_arr = []
            n_s_verts = 0
            # for g in get_geom_tree(g_id):
            for g in c:
                # for fully recursive array
                # for g in get_all_geom(geom):
                s_d = rs_utils.to_pkdict(radia.ObjDrwVTK(g, 'Axes->No'))
                n_s_verts += len(s_d.polygons.vertices)
                d_arr.append(s_d)
            # if the number of vertices of the container is more than the total
            # across its elements, a symmetry or other "additive" transformation has
            # been applied and we cannot get at the individual elements
            if n_verts > n_s_verts:
                d_arr = [d]
            pd.data = d_arr
        return pd

    def get_geom(self, name):
        return self._geoms[name].g

    def get_geom_list(self):
        return [n for n in self._geoms]

    def get_geoms(self):
        return self._geoms

    # A container is also a geometry
    def make_container(self, *args):
        ctr = {
            'geoms': []
        }
        for g_name in args:
            # key error if does not exist
            g = self.get_geom(g_name)
            ctr['geoms'].append(g)

    def __init__(self):
        self._geoms = PKDict({})

