from __future__ import absolute_import, division, print_function

from pykern.pkcollections import PKDict

GEOM_TYPE_LINES = 'lines'
GEOM_TYPE_POLYS = 'polygons'
GEOM_TYPE_VECTS = 'vectors'
GEOM_TYPES = [GEOM_TYPE_LINES, GEOM_TYPE_POLYS, GEOM_TYPE_VECTS]


def get_test_obj():
    box1 = new_geom_object()
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

    box2 = new_geom_object()
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


def _obj_has_data_type(geom_obj, d_type):
    if geom_obj is None:
        return False
    return d_type in geom_obj and len(geom_obj[d_type].vertices) > 0


def any_obj_has_data_type(geom_obj_arr, d_type):
    return any([_obj_has_data_type(o, d_type) for o in geom_obj_arr])


def new_geom_object():
    return PKDict(
        lines=PKDict(colors=[], lengths=[], vertices=[]),
        polygons=PKDict(colors=[], lengths=[], vertices=[]),
        vectors=PKDict(directions=[], magnitudes=[], vertices=[]),
    )

