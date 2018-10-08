import regeneratorRuntime from "regenerator-runtime"

// returns generator over values in range
// supports range(start, end[, step]) and range(end)
// (start inclusive, end exclusive)
// start = 0 by default
// step = 1 by default
function* range(...args) {
    let start, end, step;
    if (args.length === 1) {
        start = 0;
        end = args[0];
        step = 1;
    } else if (args.length === 2) {
        [start, end] = args;
        step = 1;
    } else if (args.length === 3) {
        [start, end, step] = args;
    }

    if (end > start) {
        if (step < 0) {
            throw new Error(`Step must bring start closer to end`);
        }
        for (let i = start; i < end; i += step) yield i;
    } else {
        if (step > 0) {
            throw new Error(`Step must bring start closer to end`);
        }
        for (let i = start; i > end; i += step) yield i;
    }
}

// returns Generator over all permutations of values in arr with length r
// adapted from python's itertools.permutations
function* permutationGenerator(arr, r=arr.length) {
    let pool = arr;
    let n = arr.length;

    let inds = Uint8Array.from(range(n));
    let cycles = Uint8Array.from(range(n, n - r, -1));

    let output = new Uint8Array(r);
    for (let i = 0; i < r; i++) output[i] = pool[inds[i]];
    yield output;

    let yielded = true;

    while (yielded) {
        yielded = false;
        for (let i = r - 1; i >=0; i--) {
            cycles[i]--;
            if (cycles[i] === 0) {
                // moves inds[i] to end, push other inds left to fill space
                let temp = inds[i];
                inds.copyWithin(i, i + 1);
                inds[inds.length - 1] = temp;

                cycles[i] = n - i;
            } else {
                let j = cycles[i];
                let swapInd = j === 0 ? 0 : inds.length - j;
                [inds[i], inds[swapInd]] = [inds[swapInd], inds[i]];

                for (let k = 0; k < r; k++) output[k] = pool[inds[k]];
                yield output;

                yielded = true;
                break;
            }
        }
    }
}

export {range, permutationGenerator}