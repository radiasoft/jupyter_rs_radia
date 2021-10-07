from ._version import version_info, __version__

def _jupyter_labextension_paths():
    return [
        {
            'src': 'labextension',
            'dest': 'jupyter_rs_radia',
        }
    ]
