from __future__ import absolute_import, division, print_function
from pykern import pkcollections


def to_pkdict(d):
    pkd = pkcollections.PKDict(d)
    for k, v in pkd.items():
        # PKDict([]) returns {} - catch that
        if not v:
            continue
        try:
            pkd[k] = to_pkdict(v)
        except TypeError:
            pass
    return pkd


class RSDebugger(object):
    def __init__(self):
        pass

    def rsdbg(self, msg):
        super(RSDebugger, self).__init__()

        # send a message to the front end to print to js console
        self.send({
            'type': 'debug',
            'msg': 'KERNEL: ' + msg
        })
