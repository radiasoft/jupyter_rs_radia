from ._version import version_info, __version__


def _jupyter_nbextension_paths():
    return [{
        'section': 'notebook',
        'src': 'static',
        'dest': 'jupyter-rs-radia-widget',
        'require': 'jupyter-rs-radia-widget/extension'
    }]
