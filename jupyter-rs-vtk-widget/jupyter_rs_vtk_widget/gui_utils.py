from __future__ import absolute_import, division, print_function
import numpy
import pykern

from numpy import linalg


def add_normals(gl_obj):
    norms = []
    p_idx = 0
    verts = numpy.array(gl_obj['polygons']['vertices'])
    for l in gl_obj['polygons']['lengths']:
        v = numpy.reshape(verts[p_idx: p_idx + 3 * l], (l, 3))
        vx = numpy.cross(v[1] - v[0], v[2] - v[1])
        nv = linalg.norm(vx)
        vx = vx / (nv if nv > 0 else 1)
        norms.extend(vx)
        p_idx += 3 * l

    gl_obj['polygons']['normals'] = norms
    return gl_obj


def get_test_obj():
    cube = new_gl_object()
    cube['polygons']['lengths'] = [4, 4, 4, 4]
    cube['polygons']['vertices'] = [
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
    cube['polygons']['colors'] = [
            1.0, 0.0, 1.0,
            0.0, 1.0, 1.0,
            1.0, 1.0, 0.0,
            1.0, 0.0, 0.0
        ]
    return {'Test': [add_normals(cube)]}


def new_gl_object():
    return {
            'lines': {
                'colors': [],
                'lengths': [],
                'vertices': []
            },
            'polygons': {
                'colors': [],
                'lengths': [],
                'vertices': []
            },
            'vectors': {
                'directions': [],
                'magnitudes': [],
                'vertices': []
            },
    }

