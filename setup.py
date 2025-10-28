from setuptools import setup
from pathlib import Path

from jupyter_packaging import (
    create_cmdclass,
    install_npm,
    ensure_targets,
    combine_commands,
)

HERE = Path(__file__).parent.resolve()
JS_DIR = PARENT / "js"

# Representative files that should exist after a successful build
jstargets = [HERE / "jupyter_rs_radia" / "labextensions" / "package.json"]

data_files_spec = [
    (
        "share/jupyter/labextensions/jupyter_rs_radia",
        "jupyter_rs_radia/labextension",
        "**",
    ),
    ("share/jupyter/labextensions/jupyter_rs_radia", ".", "install.json"),
]

cmdclass = create_cmdclass("jsdeps", data_files_spec=data_files_spec)
cmdclass["jsdeps"] = combine_commands(
    install_npm(JS_DIR, npm=["jlpm"], build_cmd="build:prod"),
    ensure_targets(jstargets),
)

# See setup.cfg for other parameters
setup(cmdclass=cmdclass)
