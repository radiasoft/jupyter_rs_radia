from __future__ import absolute_import, division, print_function

from pykern.pkcollections import PKDict

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


def new_gl_object():
    return PKDict(
        lines=PKDict(colors=[], lengths=[], vertices=[]),
        polygons=PKDict(colors=[], lengths=[], vertices=[]),
        vectors=PKDict(directions=[], magnitudes=[], vertices=[]),
    )

