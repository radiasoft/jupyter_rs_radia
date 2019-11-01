from __future__ import absolute_import, division, print_function


class RSDebugger(object):
    def __init__(self):
        pass

    def rsdebug(self, msg):
        super(RSDebugger, self).__init__()

        # send a message to the front end to print to js console
        self.send({
            'type': 'debug',
            'msg': 'KERNEL: ' + msg
        })
