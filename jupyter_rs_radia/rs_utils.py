from __future__ import absolute_import, division, print_function
from pykern import pkcollections
from pykern import pkdebug


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
        except ValueError:
            pkd[k] = v
    return pkd


class RSDebugger(object):

    def __init__(self):
        super(RSDebugger, self).__init__()

    def rsdbg(self, msg):
        # send a message to the front end to print to js console
        self.send({
            'type': 'debug',
            'msg': 'KERNEL: ' + msg
        })

    def rserr(self, msg):
        # send an error message to the front end to print to js console
        self.send({
            'type': 'error',
            'msg': 'KERNEL: ' + msg
        })

        # in addition, this will show up in the notebook
        pkdebug.pkdlog(msg)

