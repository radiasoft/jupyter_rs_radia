jupyter-rs-radia
===============================

Widget for visualizing 3D Radia models in a jupyter notebook

RadiaViewer allows users to render a magnet geometry and solve for its fields in a self-contained widget. The rendering is done by the VTK.js library.

Installation
------------

To install use pip:

    $ pip install .
    $ jupyter nbextension install --py --symlink --sys-prefix jupyter_rs_radia
    $ jupyter nbextension enable --py --sys-prefix jupyter_rs_radia

To install for jupyterlab

    $ jupyter labextension install js

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

#### Using the mouse or trackpad
Click and drag in the 3D display to rotate the objects freehand.

Shift-click and drag to pan.

Scroll to zoom in and out.

Control-click to select objects and fields (see below)

#### Camera controls
**Reset Camera**: moves the camera back to the default position.

**X**, **Y**, **Z**: moves the camera so that axis is pointing in (&#8857;) or out (&#10683;) of the screen.

**Show marker** toggles the orientation cube in the upper right corner.

### Viewer properties
**Background color**: pops up a color picker to change the background color of the 3D area.

### Geometry properties
**Geometry**: dropdown menu of geometries added in step (4) above.  Defaults to the 1st added

**View**:
* Objects: 3D visualization of the geometry (default)
* Fields: representation of various fields calculated by Radia (see below)

### Object properties
*Note: only visible when the View is set to "Objects".*

**Object color**: first control-click an object in the 3D area to select it.  Then click *Object color* to pop up a
color picker.  When complete, control-click again to deselect the object.  If the selected geometry is a container,
each member is individually selectable. However, if a member is also a container, it is not further subdivided


**Surface alpha**: fades the faces of the objects.  The edges are unaffected.

**Show edges**: toggles the edges of the objects.

### Field properties
*Note: only visible when the View is set to "Fields".*

**Color map**: colors field vectors according to their magnitude. Choices include:
* afmhot
* coolwarm
* grayscale
* jet
* viridis (default)

**Scaling**: changes the relative sizes of field vectors according to their magnitude.  Choices include:
* Uniform: all vectors have the same length
* Linear: vectors scale linearly according to their relative magnitude, i.e.

       *s =  (|v| - minV) / (maxV - minV)*
       
    where minV and maxV are the minimum and maximum magnitudes among the vectors
    
* Log: vectors scale linearly according to the relative **log** of their magnitude, i.e.

        *s =  (maxV - minV) * (ln(|v|) - minLogV) / (maxLogV - minLogV)*
    
    where minLogV and maxLogV are the minimum and maximum log magnitudes. The *(maxV - minV)* factor is there to keep
    the linear- and log-scaled vectors in the same visual range
    
#### Radia controls
**Field**: selects the field plotted. Choices include:
* M (magnetization)
* B (magnetic field)
* A (vector potential)
* H (magnetic field strength)
* J (current density)

Radia calculates the magnetization within subdivided passive magnet elements. The other fields require the
user to define where they are evaluated:

**Path** adds points for evaluation of the fields. Choices include:
* Line: set a start point, end point, and number of evaluation points.
* Circle: set the center, radius, euler angles of the normal of circle's plane, and number of evaluation points.
* Manual: add points one at a time
* File: upload points from a text file.  The coordinates must be flattened and comma-delimited
(i.e. *x0, y0, z0, x1, y1, z1,...*)

Add the path(s) of interest with the **+** button.  The points will be appended to those already in place, with the
exception of those added from a file.  In that case any existing points are deleted.  List all the current points
with `rv.get_field_points()`.

**Precision**, **Max iterations**, **Method**: refer to the Radia documentation for precise definitions of these
settings.

**Solve**: execute `RadSolve()`.  When complete, the solution will be reflected in the display of field vectors.
Control-click an individual vector to see its magnitude and direction, or list the full set of field points and
values wiith `rv.get_result()`.


