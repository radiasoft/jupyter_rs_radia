from __future__ import absolute_import, division, print_function
import numpy
import pykern

from numpy import linalg
from pykern import pkcollections
from pykern import pkdebug


def _to_pkdict(d):
    pkd = pkcollections.PKDict(d)
    for k, v in pkd.items():
        # PKDict([]) returns {} - catch that
        if not v:
            continue
        try:
            pkd[k] = _to_pkdict(v)
        except TypeError:
            pass
    return pkd

def add_normals(obj):
    norms = []
    p_idx = 0
    gl_obj = _to_pkdict(obj)
    verts = numpy.array(gl_obj.polygons.vertices)
    for l in gl_obj.polygons.lengths:
        v = numpy.reshape(verts[p_idx: p_idx + 3 * l], (l, 3))
        vx = numpy.cross(v[1] - v[0], v[2] - v[1])
        nv = linalg.norm(vx)
        vx = vx / (nv if nv > 0 else 1)
        norms.extend(vx)
        p_idx += 3 * l

    gl_obj.polygons.normals = norms
    return gl_obj


def get_test_obj():
    data = pkcollections.PKDict({})
    box1 = new_gl_object()
    box1.polygons.lengths = [4, 4, 4, 4]
    box1.polygons.vertices = [
        -10, -10, -10,
        10, -10, -10,
        10, -10, 10,
        -10, -10, 10,

        10, -10, -10,
        10, 10, -10,
        10, 10, 10,
        10, -10, 10,

        10, 10, -10,
        10, 10, 10,
        -10, 10, 10,
        -10, 10, -10,

        -10, 10, -10,
        -10, 10, 10,
        -10, -10, 10,
        -10, -10, -10
    ]
    box1.polygons.colors = [
        1.0, 0.0, 1.0,
        0.0, 1.0, 1.0,
        1.0, 1.0, 0.0,
        1.0, 0.0, 0.0
    ]

    box2 = new_gl_object()
    box2.polygons.lengths = [4, 4, 4, 4]
    box2.polygons.vertices = [
        15, -5, 15,
        15, 5, 15,
        25, 5, 15,
        25, -5, 15,

        15, -5, -15,
        15, 5, -15,
        25, 5, -15,
        25, -5, -15,

        25, 5, -15,
        25, 5, 15,
        25, -5, 15,
        25, -5, -15,

        15, 5, -15,
        15, 5, 15,
        15, -5, 15,
        15, -5, -15,
    ]
    box2.polygons.colors = [
        1.0, 0.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 0.0, 1.0,
        1.0, 1.0, 0.0,
    ]

    data.Test = [
        add_normals(box2),
        add_normals(box1)
    ]

    return data


def new_gl_object():
    return pkcollections.PKDict({
            'lines': pkcollections.PKDict({
                'colors': [],
                'lengths': [],
                'vertices': []
            }),
            'polygons': pkcollections.PKDict({
                'colors': [],
                'lengths': [],
                'vertices': []
            }),
            'vectors': pkcollections.PKDict({
                'directions': [],
                'magnitudes': [],
                'vertices': []
            }),
    })

