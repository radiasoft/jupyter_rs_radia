from __future__ import absolute_import, division, print_function


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

