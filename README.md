jupyter-rs-radia
===============================

Radia widget for Jupyter

Installation
------------

To install use pip:

    $ pip install .
    $ jupyter nbextension enable --py --sys-prefix jupyter_rs_radia

To install for jupyterlab

    $ cd js
    $ jupyter labextension install .

For a development installation (requires npm),

    $ git clone https://github.com/radiasoft/jupyter-rs-radia.git
    $ cd jupyter-rs-radia
    $ pip install -e .
    $ jupyter nbextension install --py --symlink --sys-prefix jupyter_rs_radia
    $ jupyter nbextension enable --py --sys-prefix jupyter_rs_radia
    $ jupyter labextension install js

When actively developing your extension, build Jupyter Lab with the command:

    $ jupyter lab --watch

This take a minute or so to get started, but then allows you to hot-reload your javascript extension.
To see a change, save your javascript, watch the terminal for an update.

Note on first `jupyter lab --watch`, you may need to touch a file to get Jupyter Lab to open.
