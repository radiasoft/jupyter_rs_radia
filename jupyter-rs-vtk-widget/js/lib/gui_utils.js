let rsUtils = require('./rs_utils');

const COLOR_MAP = {
    afmhot:
        [
            '0000000200000400000600000800000a00000c00000e00001000001200001400001600001800001a00001c00001e0000',
            '2000002200002400002600002800002a00002c00002e00003000003200003400003600003800003a00003c00003e0000',
            '4000004200004400004600004800004a00004c00004e00005000005200005400005600005800005a00005c00005e0000',
            '6000006200006400006600006800006a00006c00006e00007000007200007400007600007800007a00007c00007e0000',
            '8000008202008404008607008808008a0a008c0d008e0f009010009212009414009617009818009a1a009c1d009e1f00',
            'a02000a22200a42400a62700a82800aa2a00ac2d00ae2f00b03000b23200b43400b63700b83800ba3a00bc3d00be3f00',
            'c04000c24200c44400c64600c84800ca4a00cc4d00ce4e00d05000d25200d45400d65600d85800da5a00dc5d00de5e00',
            'e06000e26200e46400e66600e86800ea6a00ec6d00ee6e00f07000f27200f47400f67600f87800fa7a00fc7d00fe7e00',
            'ff8001ff8203ff8405ff8607ff8809ff8b0bff8c0dff8e0fff9011ff9213ff9415ff9617ff9919ff9b1bff9c1dff9e1f',
            'ffa021ffa223ffa425ffa627ffa829ffab2bffac2dffae2fffb031ffb233ffb435ffb637ffb939ffbb3bffbc3dffbe3f',
            'ffc041ffc243ffc445ffc647ffc849ffcb4bffcc4dffce4fffd051ffd253ffd455ffd657ffd959ffdb5bffdc5dffde5f',
            'ffe061ffe263ffe465ffe667ffe869ffeb6bffec6dffee6ffff071fff273fff475fff677fff979fffb7bfffc7dfffe7f',
            'ffff81ffff83ffff85ffff87ffff89ffff8bffff8dffff8fffff91ffff93ffff95ffff97ffff99ffff9bffff9dffff9f',
            'ffffa1ffffa3ffffa5ffffa7ffffa9ffffabffffadffffafffffb1ffffb3ffffb5ffffb7ffffb9ffffbbffffbdffffbf',
            'ffffc1ffffc3ffffc5ffffc7ffffc9ffffcbffffcdffffcfffffd1ffffd3ffffd5ffffd7ffffd9ffffdbffffddffffdf',
            'ffffe1ffffe3ffffe5ffffe7ffffe9ffffebffffedffffeffffff1fffff3fffff5fffff7fffff9fffffbfffffdffffff',
        ].join(''),
    coolwarm:
        [
            '3b4cc03c4ec23d50c33e51c53f53c64055c84257c94358cb445acc455cce465ecf485fd14961d24a63d34b64d54c66d6',
            '4e68d84f69d9506bda516ddb536edd5470de5572df5673e05875e15977e35a78e45b7ae55d7ce65e7de75f7fe86180e9',
            '6282ea6384eb6485ec6687ed6788ee688aef6a8bef6b8df06c8ff16e90f26f92f37093f37295f47396f57597f67699f6',
            '779af7799cf87a9df87b9ff97da0f97ea1fa80a3fa81a4fb82a6fb84a7fc85a8fc86a9fc88abfd89acfd8badfd8caffe',
            '8db0fe8fb1fe90b2fe92b4fe93b5fe94b6ff96b7ff97b8ff98b9ff9abbff9bbcff9dbdff9ebeff9fbfffa1c0ffa2c1ff',
            'a3c2fea5c3fea6c4fea7c5fea9c6fdaac7fdabc8fdadc9fdaec9fcafcafcb1cbfcb2ccfbb3cdfbb5cdfab6cefab7cff9',
            'b9d0f9bad0f8bbd1f8bcd2f7bed2f6bfd3f6c0d4f5c1d4f4c3d5f4c4d5f3c5d6f2c6d6f1c7d7f0c9d7f0cad8efcbd8ee',
            'ccd9edcdd9eccedaebcfdaead1dae9d2dbe8d3dbe7d4dbe6d5dbe5d6dce4d7dce3d8dce2d9dce1dadce0dbdcdedcdddd',
            'dddcdcdedcdbdfdbd9e0dbd8e1dad6e2dad5e3d9d3e4d9d2e5d8d1e6d7cfe7d7cee8d6cce9d5cbead5c9ead4c8ebd3c6',
            'ecd3c5edd2c3edd1c2eed0c0efcfbfefcebdf0cdbbf1cdbaf1ccb8f2cbb7f2cab5f2c9b4f3c8b2f3c7b1f4c6aff4c5ad',
            'f5c4acf5c2aaf5c1a9f5c0a7f6bfa6f6bea4f6bda2f7bca1f7ba9ff7b99ef7b89cf7b79bf7b599f7b497f7b396f7b194',
            'f7b093f7af91f7ad90f7ac8ef7aa8cf7a98bf7a889f7a688f6a586f6a385f6a283f5a081f59f80f59d7ef59c7df49a7b',
            'f4987af39778f39577f39475f29274f29072f18f71f18d6ff08b6ef08a6cef886bee8669ee8468ed8366ec8165ec7f63',
            'eb7d62ea7b60e97a5fe9785de8765ce7745be67259e57058e46e56e36c55e36b54e26952e16751e0654fdf634ede614d',
            'dd5f4bdc5d4ada5a49d95847d85646d75445d65244d55042d44e41d24b40d1493fd0473dcf453ccd423bcc403acb3e38',
            'ca3b37c83836c73635c53334c43032c32e31c12b30c0282fbe242ebd1f2dbb1b2cba162bb8122ab70d28b50927b40426',
        ].join(''),
    grayscale:
        [
            '333333',
            'ffffff'
        ].join(''),
    jet:
        [
            '00008000008400008900008d00009200009600009b00009f0000a40000a80000ad0000b20000b60000bb0000bf0000c4',
            '0000c80000cd0000d10000d60000da0000df0000e30000e80000ed0000f10000f60000fa0000ff0000ff0000ff0000ff',
            '0000ff0004ff0008ff000cff0010ff0014ff0018ff001cff0020ff0024ff0028ff002cff0030ff0034ff0038ff003cff',
            '0040ff0044ff0048ff004cff0050ff0054ff0058ff005cff0060ff0064ff0068ff006cff0070ff0074ff0078ff007cff',
            '0080ff0084ff0088ff008cff0090ff0094ff0098ff009cff00a0ff00a4ff00a8ff00acff00b0ff00b4ff00b8ff00bcff',
            '00c0ff00c4ff00c8ff00ccff00d0ff00d4ff00d8ff00dcfe00e0fb00e4f802e8f406ecf109f0ee0cf4eb0ff8e713fce4',
            '16ffe119ffde1cffdb1fffd723ffd426ffd129ffce2cffca30ffc733ffc436ffc139ffbe3cffba40ffb743ffb446ffb1',
            '49ffad4dffaa50ffa753ffa456ffa05aff9d5dff9a60ff9763ff9466ff906aff8d6dff8a70ff8773ff8377ff807aff7d',
            '7dff7a80ff7783ff7387ff708aff6d8dff6a90ff6694ff6397ff609aff5d9dff5aa0ff56a4ff53a7ff50aaff4dadff49',
            'b1ff46b4ff43b7ff40baff3cbeff39c1ff36c4ff33c7ff30caff2cceff29d1ff26d4ff23d7ff1fdbff1cdeff19e1ff16',
            'e4ff13e7ff0febff0ceeff09f1fc06f4f802f8f500fbf100feed00ffea00ffe600ffe200ffde00ffdb00ffd700ffd300',
            'ffd000ffcc00ffc800ffc400ffc100ffbd00ffb900ffb600ffb200ffae00ffab00ffa700ffa300ff9f00ff9c00ff9800',
            'ff9400ff9100ff8d00ff8900ff8600ff8200ff7e00ff7a00ff7700ff7300ff6f00ff6c00ff6800ff6400ff6000ff5d00',
            'ff5900ff5500ff5200ff4e00ff4a00ff4700ff4300ff3f00ff3b00ff3800ff3400ff3000ff2d00ff2900ff2500ff2200',
            'ff1e00ff1a00ff1600ff1300fa0f00f60b00f10800ed0400e80000e40000df0000da0000d60000d10000cd0000c80000',
            'c40000bf0000bb0000b60000b20000ad0000a80000a400009f00009b00009600009200008d0000890000840000800000',
        ].join(''),
    viridis:
        [
            '44015444025645045745055946075a46085c460a5d460b5e470d60470e61471063471164471365481467481668481769',
            '48186a481a6c481b6d481c6e481d6f481f70482071482173482374482475482576482677482878482979472a7a472c7a',
            '472d7b472e7c472f7d46307e46327e46337f463480453581453781453882443983443a83443b84433d84433e85423f85',
            '4240864241864142874144874045884046883f47883f48893e49893e4a893e4c8a3d4d8a3d4e8a3c4f8a3c508b3b518b',
            '3b528b3a538b3a548c39558c39568c38588c38598c375a8c375b8d365c8d365d8d355e8d355f8d34608d34618d33628d',
            '33638d32648e32658e31668e31678e31688e30698e306a8e2f6b8e2f6c8e2e6d8e2e6e8e2e6f8e2d708e2d718e2c718e',
            '2c728e2c738e2b748e2b758e2a768e2a778e2a788e29798e297a8e297b8e287c8e287d8e277e8e277f8e27808e26818e',
            '26828e26828e25838e25848e25858e24868e24878e23888e23898e238a8d228b8d228c8d228d8d218e8d218f8d21908d',
            '21918c20928c20928c20938c1f948c1f958b1f968b1f978b1f988b1f998a1f9a8a1e9b8a1e9c891e9d891f9e891f9f88',
            '1fa0881fa1881fa1871fa28720a38620a48621a58521a68522a78522a88423a98324aa8325ab8225ac8226ad8127ad81',
            '28ae8029af7f2ab07f2cb17e2db27d2eb37c2fb47c31b57b32b67a34b67935b77937b87838b9773aba763bbb753dbc74',
            '3fbc7340bd7242be7144bf7046c06f48c16e4ac16d4cc26c4ec36b50c46a52c56954c56856c66758c7655ac8645cc863',
            '5ec96260ca6063cb5f65cb5e67cc5c69cd5b6ccd5a6ece5870cf5773d05675d05477d1537ad1517cd2507fd34e81d34d',
            '84d44b86d54989d5488bd6468ed64590d74393d74195d84098d83e9bd93c9dd93ba0da39a2da37a5db36a8db34aadc32',
            'addc30b0dd2fb2dd2db5de2bb8de29bade28bddf26c0df25c2df23c5e021c8e020cae11fcde11dd0e11cd2e21bd5e21a',
            'd8e219dae319dde318dfe318e2e418e5e419e7e419eae51aece51befe51cf1e51df4e61ef6e620f8e621fbe723fde725',
        ].join(''),
};

function colorsFromString(s) {
    return s.match(/.{6}/g).map(function(x) {
        return parseInt(x, 16);
    });
}

// returns either black or white depending on the background color
// there are more complex formulas if needed
function fgColorForBG(bgColor, format) {
    // assume single integer to start
    const bg = rgbFromColor(bgColor, 1.0);
    rsUtils.rsdbg('fg for bg', bgColor, bg);
    let fg = bg[0] * 0.299 + bg[1] * 0.587 + bg[2] * 0.114 > 186 ? 0 : 16777215;
    return formatColors([fg], format)[0];
}

function formatColors(colors, format) {
    // fix this up...
    if (format === '#') {
        let cx = [];
        for (let i = 0; i < colors.length; ++i) {
            let str = '#';
            let rgb = rgbFromColor(colors[i], 1.0);
            for (let j = 0; j < rgb.length; ++j) {
                let n = rgb[j];
                let s = Number(n).toString(16);
                if (s.length === 1) {
                    s = '0' + s;
                }
                str = str + s;
            }
            cx.push(str);
        }
        //return colors.map(function (c) {
        //    return '#' + Number(c).toString(16);
        //});
        return cx;
    }
    return colors;
}

// interpolate each component to num_colors if the color map has fewer values
//TODO(mvk): interpolate better
function getColorMap(name, numColors, format) {
    if (! numColors) {
        numColors = 256;
    }
    let c = colorsFromString(COLOR_MAP[name]);
    if (c.length >= numColors) {
        return formatColors(c, format);
    }
    let rgbMins = rgbFromColor(Math.min.apply(null, c), 1.0);
    let rgbMaxes = rgbFromColor(Math.max.apply(null, c), 1.0);
    let res = Array(numColors).fill(0);
    for (let i = 0; i < 3; ++i) {
        let comp = rsUtils.linearlySpacedArray(rgbMins[i], rgbMaxes[i], numColors).map(function (v) {
            return Math.pow(256, 2 - i) * Math.floor(v);
        });
        res = res.map(function (v, j) {
            return v + comp[j];
        });
    }
    return formatColors(res, format);
}

function getColorMaps() {
    return Object.keys(COLOR_MAP);
}

function rgbFromColor(c, scale)  {
    if (! scale) {
        scale = 256.0;
    }
    let b = (c % 256) / scale;
    let g = (((c - b) / 256) % 256) / scale;
    let r = ((c - b - 256 * g) / (256 * 256)) / scale;
    return [r, g, b];
}

module.exports = {
    fgColorForBG: fgColorForBG,
    getColorMap: getColorMap,
    getColorMaps: getColorMaps,
    rgbFromColor: rgbFromColor,
};
