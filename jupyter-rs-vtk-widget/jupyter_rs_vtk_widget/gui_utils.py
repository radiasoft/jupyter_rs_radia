from __future__ import absolute_import, division, print_function

from pykern.pkcollections import PKDict

GL_TYPE_LINES = 'lines'
GL_TYPE_POLYS = 'polygons'
GL_TYPE_VECTS = 'vectors'
GL_TYPES = [GL_TYPE_LINES, GL_TYPE_POLYS, GL_TYPE_VECTS]


def get_test_obj():
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

    return PKDict(name='Test', data=[box1, box2])


def _obj_has_data_type(gl_obj, d_type):
    if gl_obj is None:
        return False
    return d_type in gl_obj and len(gl_obj[d_type]['vertices']) > 0


def any_obj_has_data_type(gl_obj_arr, d_type):
    return any([_obj_has_data_type(o, d_type) for o in gl_obj_arr])


def has_polys(gl_obj):
    return _obj_has_data_type(gl_obj, GL_TYPE_POLYS)


def has_vectors(gl_obj):
    return _obj_has_data_type(gl_obj, GL_TYPE_VECTS)


def new_gl_object():
    return PKDict(
        lines=PKDict(colors=[], lengths=[], vertices=[]),
        polygons=PKDict(colors=[], lengths=[], vertices=[]),
        vectors=PKDict(directions=[], magnitudes=[], vertices=[]),
    )

