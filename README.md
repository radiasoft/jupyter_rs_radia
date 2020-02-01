jupyter-rs-radia
===============================

Widget for visualizing 3D Radia models in a jupyter notebook

RadiaViewer allows users to render a magnet geometry and solve for its fields in a self-contained widget. The rendering is done by the VTK.js library.

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

This takes a minute or so to get started, but then allows you to hot-reload your javascript extension.
To see a change, save your javascript, watch the terminal for an update.

Note on first `jupyter lab --watch`, you may need to touch a file to get Jupyter Lab to open.

Setup
------------
This guide assumes familiarity with Raida and its python API.

1. In your notebook, add `from jupyter_rs_radia import radia_viewer`
2. Create an instance of the RadiaViewer: `rv = radia_viewer.RadiaViewer()`
3. Define your geometries, materials, etc.
4. Add the geometries you wish to display: `rv.add_geometry(<name>, <ref>)`
5. Display them! `rv.display()`

Understanding the viewer
------------
You should see your selected geometry as below:

![Radia_Example05](https://github.com/radiasoft/jupyter-rs-radia/blob/master/examples/Radia_Example05.png)

### Camera controls
#### Using the mouse or trackpad:
Click and drag in the 3D display to rotate the objects freehand.

Shift-click and drag to pan.

Scroll to zoom in and out.

#### Other controls:
**Reset Camera**: moves the camera back to the default position.

**X**, **Y**, **Z**: moves the camera so that axis is pointing in (&#8857;) or out (&#10683;) of the screen.

**Show marker** toggles the cube in the upper right corner.

### Viewer properties
**Background color**: pops up a color picker to change the background color of the 3D area.

### Object properties
*Note: only visible when the View (see below) is set to "Objects".*

**Object color**: first control-click an object in the 3D area to select it.  Then click *Object color* to pop up a color picker.  When complete, control-click again to deselect the object

**Surface alpha**: fades the faces of the objects.  The edges are unaffected.
radia controls

Solve
ctrl-click to select objects or arrows
Notes
------------
If the selected geometry is a container, each member is individually selectable via ctl-left click. However, if a member is also a container, it is not further subdivided

