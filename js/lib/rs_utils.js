let rsdbg = console.log.bind(console);
let rslog = console.log.bind(console);
let rserr = console.error.bind(console);

function indexArray(size) {
    var res = [];
    for (var i = 0; i < size; res.push(i++)) {}
    return res;
}

function linearlySpacedArray(start, stop, nsteps) {
   if (nsteps < 1) {
       throw new Error('linearlySpacedArray: steps ' + nsteps + ' < 1');
   }
   let delta = (stop - start) / (nsteps - 1);
   let res = indexArray(nsteps).map(function(d) {
       return start + d * delta;
   });
   res[res.length - 1] = stop;

   if (res.length != nsteps) {
       throw new Error('linearlySpacedArray: steps ' + nsteps + ' != ' + res.length);
   }
   return res;
}

function normalize(seq) {
    const sMax = Math.max.apply(null, seq);
    const sMin = Math.min.apply(null, seq);
    let sRange = sMax - sMin;
    sRange = sRange > 0 ? sRange : 1.0;
    return seq.map(function (v) {
        return (v - sMin) / sRange;
    });
}

function roundToPlaces(val, p) {
    if (p < 0) {
        return n;
    }
    const r = Math.pow(10, p);
    return Math.round(val * r) / r;
}

module.exports = {
    indexArray: indexArray,
    linearlySpacedArray: linearlySpacedArray,
    normalize: normalize,
    roundToPlaces: roundToPlaces,
    rsdbg: rsdbg,
    rserr: rserr,
    rslog: rslog,
};
