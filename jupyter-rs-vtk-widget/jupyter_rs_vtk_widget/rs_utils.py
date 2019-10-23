from __future__ import absolute_import, division, print_function


# helper functions
# send a message to the front end to print to js console
def rsdebug(widget, msg):
    widget.send({
        'type': 'debug',
        'msg': 'KERNEL: ' + msg
    })
