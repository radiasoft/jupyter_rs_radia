jupyter-rs-vtk-widget
===============================

VTK widget for Jupyter

Installation
------------

To install use pip:

    $ pip install jupyter_rs_vtk_widget
    $ jupyter nbextension enable --py --sys-prefix jupyter_rs_vtk_widget

To install for jupyterlab

    $ jupyter labextension install jupyter_rs_vtk_widget

For a development installation (requires npm),

    $ git clone https://github.com/radiasoft/rsjpyradia.git
    $ cd jupyter-rs-vtk-widget
    $ pip install -e .
    $ jupyter nbextension install --py --symlink --sys-prefix jupyter_rs_vtk_widget
    $ jupyter nbextension enable --py --sys-prefix jupyter_rs_vtk_widget
