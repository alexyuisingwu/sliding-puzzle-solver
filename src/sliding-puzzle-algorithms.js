// Operator pre-computation, in-place modification of grid state for ida* based on
// "Implementing Fast Heuristic Search Code"
// by Ethan Burns and Matthew Hatem and Michael J. Leighton and Wheeler Ruml

// Linear conflict heuristic based on
// "Criticizing Solutions to Relaxed Models Yields Powerful Admissible Heuristics"
// by Othar Hansson and Andrew Mayer

// TODO: modify readme to explain how to use node + webpack + babel

// TODO: write function to time performance of different alg+heuristic combos

// TODO: fix freeze when solving some 5x4 puzzles (and presumably those larger than that) using A*
// iteration limit should work, but not working and/or iterations taking substantially more memory + longer

import FastPriorityQueue from 'fastpriorityqueue'
import ndarray from 'ndarray'
import AVLTree from 'avl'

import {range, permutationGenerator} from './math-utils'
import regeneratorRuntime from 'regenerator-runtime'

const REVERSE_MOVE_MAP = {
    'r': 'l',
    'l': 'r',
    'd': 'u',
    'u': 'd'
}

// TODO: if using pattern database, consider encoding pattern numbers into bytes and storing in int
// probably use 6-6-3 pattern database (while not fastest, takes up moderate amount of memory)
// consider using IndexedDB for db storage
// pros: simple, well-supported
// cons: probably slower than loading Map into memory
// alternative: look into storing db as bytes, read whole db into memory at start and query from there
// TODO: note that pattern dbs will make it difficult to allow non-square puzzles with dimensions > 4

// NOTE: methods not static to support using cached MD data specific to puzzle
// grid not part of constructor as single heuristic passed between all grids in a given Puzzle
class ManhattanHeuristic {

    constructor(numRows, numCols) {
        this.numRows = numRows;
        this.numCols = numCols;
        this.numTiles = numRows * numCols;

        this._precompute();

        this.moveNumberMap = {
            'l': 0,
            'r': 1,
            'u': 2,
            'd': 3
        }
    }

    // TODO: change so precompute called once for all puzzles of same size
    // since no matter what user settings are called, all possible inds and goalInds accounted for
    // store as class property, and change heuristics back to static

    // returns whether precomputation could be completed
    _precompute() {

        // stop precomputing when numTiles > 100 (50,000 array entries in cache)
        if (this.numTiles > 100) {
            return false;
        }

        // _md.get(i, j) = md value at ind = i, goalInd = j
        this._md = ndarray(new Uint16Array(this.numTiles ** 2), [this.numTiles, this.numTiles]);
        // _mdDelta.get(i, j, k) = change in MD when ind = i, goalInd = j, and move = k
        // where move = 0 -> 'l', 1 -> 'r', 2 -> 'u' 3 -> 'd'
        this._mdDelta = ndarray(new Int8Array(4 * this.numTiles ** 2), [this.numTiles, this.numTiles, 4]);

        // l, r, u, d
        const moveDeltaMap = Int16Array.from([-1, 1, -this.numCols, this.numCols]);

        let ind, goalInd;

        ind = 0;
        for (let row1 = 0; row1 < this.numRows; row1++) {
            for (let col1 = 0; col1 < this.numCols; col1++) {
                goalInd = 0;
                for (let row2 = 0; row2 < this.numRows; row2++) {
                    for (let col2 = 0; col2 < this.numCols; col2++) {
                        this._md.set(ind, goalInd, Math.abs(row2 - row1) + Math.abs(col2 - col1)); 
                        goalInd++;
                    }
                }
                ind++;
            }
        }

        ind = 0;
        for (let row1 = 0; row1 < this.numRows; row1++) {
            for (let col1 = 0; col1 < this.numCols; col1++) {
                goalInd = 0;
                for (let row2 = 0; row2 < this.numRows; row2++) {
                    for (let col2 = 0; col2 < this.numCols; col2++) {
                        let startMD = this._md.get(ind, goalInd);
                        // l, r, u, d
                        for (let move = 0; move < 4; move++) {
                            let endMD = this._md.get(ind + moveDeltaMap[move], goalInd);
                            this._mdDelta.set(ind, goalInd, move, endMD - startMD);
                        }
                        goalInd++;
                    }
                }
                ind++;
            }
        }
        return true;
    }

    // returns heuristic distance from goal
    calculate(grid) {
        let dist = 0;
        for (let i = 0; i < grid.tiles.length; i++) {
            if (i !== grid.emptyPos) {
                if (this._md) {
                    dist += this._md.get(i, grid.tiles[i]);
                } else {
                    dist += grid.getTileDist(i, grid.tiles[i]);
                }
            }
        }
        return dist;
    }

    // TODO: consider refactoring to just use "grid" to prevent confusion

    // Returns updated heuristic distance from goal after move
    // newGrid = Grid after move (distinct object), with all properties updated besides heuristicValue
    // startInd = ind moved tile started in
    // endInd = ind moved tile ended up in
    // move = single-letter move within 'l/r/u/d'
    // NOTE: assumes newGrid's heuristic value is same as old grid (not yet updated)
    update(newGrid, startInd, endInd, move) {
        return this.getUpdateDelta(newGrid, startInd, endInd, move) + newGrid.heuristicValue;
    }

    // returns change in heuristic distance from move
    // newGrid = Grid after move (distinct object), with all properties updated besides heuristicValue
    // startInd = ind moved tile started in
    // endInd = ind moved tile ended up in
    // move = single-letter move within 'l/r/u/d'
    getUpdateDelta(newGrid, startInd, endInd, move) {

        if (this._mdDelta) {
            // get(movedInd, goalInd, move)
            // (goalInd is value of tile at endInd, as newGrid's endInd is oldGrid's startInd)
            return this._mdDelta.get(startInd, newGrid.tiles[endInd], this.moveNumberMap[move]);
        }
        let goalInd = newGrid.tiles[endInd],
            goalRow = newGrid.getTileRow(goalInd),
            goalCol = newGrid.getTileCol(goalInd);

        let startRow = newGrid.getTileRow(startInd),
            startCol = newGrid.getTileCol(startInd);

        let endRow = newGrid.getTileRow(endInd),
            endCol = newGrid.getTileCol(endInd);

        return (Math.abs(goalRow - endRow) + Math.abs(goalCol - endCol)) -
                Math.abs(goalRow - startRow) + Math.abs(goalCol - startCol);
    }

    // returns whether heuristic value indicates if puzzle is solved
    isSolved(heuristicValue) {
        return heuristicValue === 0;
    }
}

// NOTE: methods not static to support using cached MD data specific to puzzle
class LinearConflictHeuristic extends ManhattanHeuristic{

    constructor(numRows, numCols) {
        super(numRows, numCols);
    }

    // returns whether precomputation could be completed
    _precompute() {
        super._precompute();

        let n = Math.max(this.numRows, this.numCols);

        // avoid precomputation when n > 8 or puzzle is 1D (can just use MD)
        // 9 has 986,409 perms
        // 8 has 19,173,960 spaces (each > 1 byte given Uint8Array and overhead)
        // while precomputing still feasible for n = 9, no point as > 1D puzzles not
        // optimally solvable at that point for current solvers here
        // ndarray also becomes too large when n = 10 (throws error)
        if (n > 8 || this.numRows === 1 || this.numCols === 1) {
            return false;
        }

        // maps size of orderings of tiles in their goal row/col to an ndarray
        // mapping the orderings themselves to the linear conflict heuristic value

        // NOTE: ndarray used instead of map, as constant toString() computationally costlier
        // than indexing into ndarray
        // cons: much larger space consumption (sum of n^k from k = 1 to n)
        // consumes 19,173,960 spaces (each > 1 byte given Uint8Array and overhead) when n = 8
        this._lc = new Array(n);
        for (let permSize = 1; permSize <= n; permSize++) {
            this._lc[permSize] = ndarray(
                new Uint8Array(n ** permSize),
                new Uint8Array(permSize).fill(n)
            )
        }

        for (let perm of this._permutationHelper(n)) {
            this._lc[perm.length].set(...perm, this._calculate(perm));
        }

        return true;
    }

    // returns Generator over possible orderings of tiles in their goal rows/cols
    // ex: [2, 1, 0] = 0th ind -> tile with goal ind of 2, 1st ind -> tile with goal ind of 1
    // NOTE: # permutations = sum of n permute k from k = 1 to n = ⌊en!−1⌋
    *_permutationHelper(n) {
        // while Int8Array goes from 0 to 255, acceptable as memory requirements
        // balloon when numRows/numCols > 8
        let arr = Uint8Array.from(range(n));
        for (let permSize = 1; permSize <= n; permSize++) {
            for (let perm of permutationGenerator(arr, permSize)) {
                yield perm;
            }
        }
    }

    _calculate(arr) {
        let map = new Map();
        for (let i = 0; i < arr.length; i++) {
            let goalInd = arr[i];
            map.set(i, {goalInd, conflicts: new Set()});
        }

        return this._calculateForMap(map);
    }
    // TODO: consider separating lc condition check into new function for possibly better performance
    // (less "if" checks)

    // calculates linear conflict of specified grid
    // optional start/end params allow specifying section of grid to calculate conflict heuristic for
    // rectangular section of grid, where start is inclusive and end if exclusive
    // calcMD determines if calculate() includes Manhattan Distance in heuristic calculation
    // NOTE: since linear conflict + MD always admissible and at least as good, only use
    // calcMD = false for testing or if you plan on calculating MD in a different way
    // ex: calculate(grid, 0, 3, 1, 2) calculates heuristic for 3 tile tall vertical chunk
    // in col[1] from row[0->2]
    // Heuristic explanation:
    // linear conflict = 2 tiles in the same goal row/col but have inversion relationship.
    // horizontal: (a is to right of b but a's goal is to left of b's goal)
    // vertical: same but with bottom and top instead of right and left
    // To reach goal positions, one of the tiles in the pair has to move out of the way
    // for the other tile to reach their goal. The moved tile has to move back into their
    // goal row/col to reach their goals.
    //
    // Linear conflict is calculated on every row and column, and can be combined with
    // manhattan distance heuristic to make better admissible heuristic,
    // as manhattan distance heuristic doesn't account for moving tiles out of the way
    // and linear conflct doesn't account for moving to the correct tile position 
    //
    // WARNING: You can't just add 2 to the heuristic value for each inversion found,
    // as moving one tile out of the way can allow 2 tiles it conflicts with to move into their goals
    // ex: [3, 1, 2] has goal positions of [1, 2, 3]
    // to reach the goal, move 3 down and slide 1 and 2 over, and then move 3 to the goal
    // while there are 2 inversions (3, 1) and (3, 2), moving 3 out of the way for 1 means
    // that it is out of the way for 2 as well.
    // If you added 2 for each inversion, heuristic = LC = (2 + 2) + MD = (2 + 1 + 1) = 8
    // when the optimal solution only takes 6 moves ("3" down, "1" left, "2" left, "3" right x2, "3" up)
    calculate(grid) {
        let heuristicValue = 0;

        // candidateTiles.get(i) = map of tiles of row/col i that are in their goal row/col
        // map = {ind: {goalInd, conflicts}}
        // - ind = current index in flattened puzzle array
        // - goalInd = value at ind = index of the tile in the goal puzzle
        // - conflicts is a set of conflicting indices (initially empty)
        // NOTE: cols accessed at key = column index + grid.numRows
        // (first grid.numRows entries are for rows, next grid.numCols entries for columns)
        let candidateTiles = new Map();

        // determines which tiles are in their goal row and/or column
        for (let row = 0; row < this.numRows; row++) {
            for (let col = 0; col < this.numCols; col++) {

                let ind = grid.getIndex(row, col);
                let goalInd = grid.tiles[ind],
                    goalRow = grid.getTileRow(goalInd),
                    goalCol = grid.getTileCol(goalInd);

                if (ind !== grid.emptyPos) {

                    // add manhattan distance to heuristic value
                    if (this._md) {
                        heuristicValue += this._md.get(ind, goalInd);
                    } else {
                        heuristicValue += Math.abs(row - goalRow)
                                        + Math.abs(col - goalCol);
                    }
                    

                    // NOTE: single tile can be candidate for both row and col conflict
                    // as tile can be part of conflict even when it's in its goal position
                    if (grid.getTileRow(goalInd) === row) {
                        if (this._lc) {
                            if (!candidateTiles.has(row)) {
                                candidateTiles.set(row, []);
                            }
                            candidateTiles.get(row).push(goalCol);
                        } else {
                            if (!candidateTiles.has(row)) {
                                candidateTiles.set(row, new Map());
                            }
                            candidateTiles.get(row).set(ind, {goalInd, conflicts: new Set()});
                        }
                    }
                    if (grid.getTileCol(goalInd) === col) {
                        let key = grid.numRows + col;
                        if (this._lc) {
                            if (!candidateTiles.has(key)) {
                                candidateTiles.set(key, []);
                            }
                            candidateTiles.get(key).push(goalRow);
                        } else {
                            if (!candidateTiles.has(key)) {
                                candidateTiles.set(key, new Map());
                            }
                            candidateTiles.get(key).set(ind, {goalInd, conflicts: new Set()});
                        }   
                    }
                }
            }
        }

        // TODO: consider making custom function for update since only need to examine
        // if tile in 1 (known) goal dimension and map also unnecessary
        // maybe helper functions for processing each row/col?
        // don't use helpers for regular calculate() though (probably less efficient
        // since each tile would be iterated over twice (separately for row and col))
        if (this._lc) {
            // TODO: use values since keys unnecessary now
            for (let [, arr] of candidateTiles.entries()) {
                heuristicValue += this._lc[arr.length].get(...arr);
            }
        } else {
            // row/grid.numRows + col no longer relevant and can be discarded 
            for (let [, map] of candidateTiles.entries()) {
                heuristicValue += this._calculateForMap(map);
            }
        }

        return heuristicValue;
    }

    _calculateForMap(map) {
        if (map.size < 2) {
            return 0;
        }

        let heuristicValue = 0;

        for (let [ind1, {goalInd: goalInd1, conflicts: conflicts1}] of map) {
            for (let [ind2, {goalInd: goalInd2, conflicts: conflicts2}] of map) {
                if (ind2 > ind1 && goalInd2 < goalInd1) {
                    map.get(ind1).conflicts.add(ind2);
                    map.get(ind2).conflicts.add(ind1);
                }
            }
        }

        let conflictTree = new AVLTree((a, b) => {
            if (a.ind === b.ind) return 0;

            let diff = a.conflicts.size - b.conflicts.size;

                // sorts by ind ascending if conflicts equal
                // necessary to identify object by ind in tree, as node with same # conflicts
                // as desired node can appear before desired node
                return diff === 0 ? a.ind - b.ind : diff;
            });

        for (let [ind, {goalInd, conflicts}] of map) {

            if (conflicts.size > 0) {
                conflictTree.insert({conflicts, ind});
            }
        }

        let tile;

        while (conflictTree.size > 0) {
            tile = conflictTree.max();
            // NOTE: library has no option for finding and removing largest item in one step
            // could use pop() workaround with opposite comparator, but pop also calls
            // remove() after finding min in current version (1.4.4)
            conflictTree.remove(tile);

            // heuristic += 2 for each tile that must be removed before there are no conflicts
            heuristicValue += 2;

            for (let conflict of tile.conflicts) {
                // corresponding conflicts of conflicting tile
                // ex: a.conflicts = [b,c], b.conflicts = [a], corrConflicts of a = (Set) [a]
                let corrConflicts = map.get(conflict).conflicts;

                let corrObj = {conflicts: corrConflicts, ind: conflict};

                conflictTree.remove(corrObj);

                // NOTE: tree uses reference to same conflicts object, so conflicts updated there as well
                corrConflicts.delete(tile.ind);

                // removed and inserted to reorder based on new number of conflicts
                if (corrConflicts.size > 0) {
                    conflictTree.insert(corrObj);
                }
            }
        }
        return heuristicValue;
    }

    // calculates LC for given row index
    // NOTE: doesn't incorporate MD
    _calculateForRow(grid, row) {
        let candidateTiles = this._lc ? [] : new Map();

        for (let col = 0; col < this.numCols; col++) {
            let ind = col + this.numCols * row;

            if (ind !== grid.emptyPos) {
                let goalInd = grid.tiles[ind],
                    goalRow = grid.getTileRow(goalInd),
                    goalCol = grid.getTileCol(goalInd);
                if (row === goalRow) {
                    if (this._lc) {
                        candidateTiles.push(goalCol);
                    } else {
                        candidateTiles.set(col, {goalInd: goalCol, conflicts: new Set()});
                    }
                }
            }
        }

        if (this._lc) {
            if (candidateTiles.length < 2) {
                return 0;
            }
            return this._lc[candidateTiles.length].get(...candidateTiles);
        }

        return this._calculateForMap(candidateTiles);
    }

    // calculates LC for given column index
    // NOTE: doesn't incorporate MD
    _calculateForCol(grid, col) {
        let candidateTiles = this._lc ? [] : new Map();

        for (let row = 0; row < this.numRows; row++) {
            let ind = col + this.numCols * row;

            if (ind !== grid.emptyPos) {
                let goalInd = grid.tiles[ind],
                    goalRow = grid.getTileRow(goalInd),
                    goalCol = grid.getTileCol(goalInd);
                if (col === goalCol) {
                    if (this._lc) {
                        candidateTiles.push(goalRow);
                    } else {
                        candidateTiles.set(row, {goalInd: goalRow, conflicts: new Set()});
                    }
                }
            }
        }

        if (this._lc) {
            if (candidateTiles.length < 2) {
                return 0;
            }
            return this._lc[candidateTiles.length].get(...candidateTiles);
        }

        return this._calculateForMap(candidateTiles);
    }

    update(newGrid, startInd, endInd, move) {
        return this.getUpdateDelta(newGrid, startInd, endInd, move) + newGrid.heuristicValue;
    }

    // TODO: consider splitting update into 2 parts so newGrid isn't switched back and forth in IDA*
    // (or create helper that also takes in start and end locations of tile as well as newGrid
    // for use in IDA*)

    // TODO: have update function that returns updated grid for use in ida*
    // TODO: see if calculate() needs anything changed besides emptyPos and tile swap

    // returns change in heuristic distance from move
    // newGrid = Grid after move (distinct object), with all properties updated besides heuristicValue
    // startInd = ind moved tile started in
    // endInd = ind moved tile ended up in
    // move = single-letter move within 'l/r/u/d'
    getUpdateDelta(newGrid, startInd, endInd, move) {

        let startRow = newGrid.getTileRow(startInd),
            startCol = newGrid.getTileCol(startInd);

        let startVal = 0,
            endVal = 0;

        let func;
        let inds;

        switch (move) {
            case 'l':
                func = this._calculateForCol;
                inds = [startCol, startCol - 1];
                break;
            case 'r':
                func = this._calculateForCol;
                inds = [startCol, startCol + 1];
                break;
            case 'u':
                func = this._calculateForRow;
                inds = [startRow, startRow - 1];
                break;
            case 'd':
                func = this._calculateForRow;
                inds = [startRow, startRow + 1];
                break;
        }

        // Manhattan distance not calculated in func as only needs to be calculated
        // for single tile moved (more efficient to calculate separately)
        endVal += func.call(this, newGrid, inds[0]);
        endVal += func.call(this, newGrid, inds[1]);

        // returns grid partially to pre-move state to calculate LC for relevant cols pre-move
        newGrid.swap(startInd, endInd);
        newGrid.emptyPos = endInd;

        startVal += func.call(this, newGrid, inds[0]);
        startVal += func.call(this, newGrid, inds[1]);

        // return grid to original state
        newGrid.swap(startInd, endInd);
        newGrid.emptyPos = startInd;

        return endVal - startVal + super.getUpdateDelta(newGrid, startInd, endInd, move);
    }


    // returns whether heuristic value indicates if puzzle is solved
    isSolved(heuristicValue) {
        return heuristicValue === 0;
    }
}

// NOTE: separate from puzzle-graphic's Puzzles to ease testing and reduce memory cost in A*
class Puzzle {

    /**
     * creates new Puzzle instance
     * @param numRows # rows in grid
     * @param numCols # columns in grid
     * @param tiles flattened array of tile ids corresponding to their locations in the unsolved puzzle
     * (where ids = tile positions in the solved puzzle left to right, top to bottom, 0 indexed)
     * - ex: startGrid = [b, a, c], goalGrid = [a, b, c], return = [1, 0, 2]
     * - explanation: b = goalGrid[1], a = goalGrid[0], c = goalGrid[2]
     * @param emptyPos position of empty tile in grid
     * @param heuristic heuristic used to determine how far grid is from goal state.
     * Default heuristic is Linear Conflict, possible values are 'MD' and 'LC'
     * corresponding with manhattan distance and linear conflict respectively
     * @param solver solving algorithm to use ('IDA*' or 'A*')
     */
    constructor(numRows, numCols, tiles, emptyPos, 
        {heuristic = 'LC', solver = numRows * numCols > 9 ? 'IDA*' : 'A*'} = {}) {

        this.numRows = numRows;
        this.numCols = numCols;
        // use less memory if possible
        this.tiles = tiles.length > 256 ? Uint16Array.from(tiles): Uint8Array.from(tiles);
        this.emptyPos = emptyPos;

        let heuristicClass;
        switch (heuristic) {
            case 'MD':
                heuristicClass  = ManhattanHeuristic;
                break;
            default:
                heuristicClass = LinearConflictHeuristic;
        }

        this.heuristic = new heuristicClass(numRows, numCols);
        this.solver = solver;
    }

    // returns
    // - solution as array of moves within (l/r/u/d)
    // - -1 if solution took too long to find
    // - null if solution could not be found
    // NOTE: maxIterations ignored for 'strategic' option
    solve(maxIterations = 100000) {

        if (this.solver === 'A*') {
            return this.solveAStar(maxIterations);
        } else if (this.solver === 'IDA*') {
            return this.solveIDAStar(maxIterations);
        } else if (this.solver === 'strategic') {
            return this.solveStrategically();
        } else {
            throw new Error(`
                {this.solver} is not a valid option. Choose between 'A*', 'IDA*', and 'strategic'.`)
        }
        
    }

    solveAStar(maxIterations) {
        // TODO: consider using bucket queue instead of priority queue
        // e.g. array where key = total distance, value = node with that distance
        // also consider nested bucket queue to allow ordering by traveledDist to tie-break
        let q = new FastPriorityQueue(
        
            // NOTE: comparator puts grid1 first if return "true" (grid1 less than grid2)
            (grid1, grid2) => {
                let total1 = grid1.heuristicValue + grid1.traveledDist,
                    total2 = grid2.heuristicValue + grid2.traveledDist;

                // favor grids with more traveled distance
                // explanation: since admissisible heuristics
                // underestimate or match actual distance to goal,
                // actual distance of grid with more traveled distance is likely to be <=
                // actual distance of grid with less traveled distance
                // when total distance is equal
                return total1 === total2 ? 
                    grid1.traveledDist > grid2.traveledDist : 
                    total1 < total2;
            }
        
        );
        let grid = new Grid(this.numRows, this.numCols, this.tiles, this.emptyPos, this.heuristic, 0);
        q.add(grid);

        let curr;
        
        // maps Grid state to best/shortest (heuristic + distance traveled) found so far
        let best = new Map();
        let iterations = 0;

        while (q.size > 0) {
            if (iterations > maxIterations) {
                return -1;
            }

            curr = q.poll();

            if (curr.isSolved()) {
                console.log(iterations);
                return curr.reconstructPath();
            }

            for (let move of curr.getValidMoves()) {
                // reversing a move will never lead to an optimal path
                if (move !== Grid.getReversedMove(curr.lastMove)) {
                    let newGrid = curr.cloneAndApplyMove(move);

                    let score = newGrid.traveledDist + newGrid.heuristicValue;

                    let key = newGrid.tiles.toString();

                    // add to queue and replace best score if score better than previous best
                    // NOTE: not using <, as previous best could be undefined
                    // executes if best either undefined or >= current score
                    // NOTE: obviates need for visited set, as only adds node when
                    // better than best found so far vs. adding when better than best possible
                    // (by the time best possible is found, several nodes could be discarded
                    // by being worse than previous discovered not-yet-popped nodes)
                    if (!(score >= best.get(key))) {
                        best.set(key, score);
                        q.add(newGrid);
                    }
                }
            }
            iterations++;
        }
        // no solution found
        return null;
    }

    // TODO: make use of maxIterations or some other limiting function to stop freezing browser
    solveIDAStar(maxIterations) {
        let grid = new Grid(this.numRows, this.numCols, this.tiles, this.emptyPos, this.heuristic, 0);

        // upper bound of total distance for when to stop exploring nodes in given iteration of dfs
        let bound = grid.heuristicValue;
        let path = [];

        while (true){
            let output = this._searchIDAStar(grid, path, 0, bound);
            if (output === true) {
                return path;
            } else if (output === Infinity) {
                return null;
            }
            // upper bound of search updated to min total distance explored that was
            // greater than previous bound
            bound = output;
        }
        return null;
    }

    _searchIDAStar(grid, path, traveledDist, bound) {

        let totalDist = traveledDist + grid.heuristicValue;

        if (totalDist > bound) return totalDist;
        if (grid.isSolved()) return true;

        // tracks min total distance of all nodes explored
        let minTotalDist = Infinity;
        for (let move of grid.getValidMoves()) {
            // reversing previous move never leads to optimal solution
            if (move !== Grid.getReversedMove(path[path.length - 1])) {
                let moveRecord = grid.applyMove(move);
                path.push(move);

                let output = this._searchIDAStar(grid, path, traveledDist + 1, bound);
                if (output === true) return true;
                if (output < minTotalDist) minTotalDist = output;

                path.pop();
                grid.reverseMove(moveRecord);
            }
        }
        return minTotalDist;
    } 

    // TODO: consider moving functions into closure / avoid nesting for slightly better performance
    // (no re-instantiation on each call to solveStrategically())
    // general strategy:
    // # rows & # columns > 3:
    // - solve all rows but 
    solveStrategically() {

        let grid = new StrategicGrid(this.numRows, this.numCols, this.tiles, this.emptyPos);
        let moves = [];

        let [emptyRow, emptyCol] = [grid.getTileRow(grid.emptyPos), grid.getTileCol(grid.emptyPos)];

        // WARNING: does NOT update [row, col]
        function move(moveList) {
            for (let move of moveList) {
                moves.push(move);
                grid.applyMove(move);

                switch (move) {
                    case 'l':
                        emptyCol++;
                        break;
                    case 'r':
                        emptyCol--;
                        break;
                    case 'u':
                        emptyRow++;
                        break;
                    case 'd':
                        emptyRow--;
                        break;
                }

            }
        }

        // moves tile into its goal
        // NOTE: assumes puzzle filled from top or bottom, left to right
        // WARNING: should NOT be used for filling in columns instead of rows, as assumptions
        // will often result in invalid moves/bad solutions
        // should NOT be used for last 2 rows of puzzles as well, as those must be solved
        // column by column (solving a single row leaves remaining row no room to maneuver)
        function moveTile(ind, goalInd) {
            if (ind === goalInd) return;

            [emptyRow, emptyCol] = [grid.getTileRow(grid.emptyPos), grid.getTileCol(grid.emptyPos)];

            let [row, col] = [grid.getTileRow(ind), grid.getTileCol(ind)];
            let [goalRow, goalCol] = [grid.getTileRow(goalInd), grid.getTileCol(goalInd)];

            // moves empty out of the way of already solved tiles
            // explanation: if empty is in row with solved tiles, it must be to their right
            // more specifically, it will be in the goal col of the current tile
            // if the current tile is to the left of its goal, empty will need
            // to move left to get to its left, displacing solved tiles
            // unless it moves down (or a tile moves up into it) first
            if (col < goalCol && emptyRow === goalRow) {
                emptyRow === grid.rowEnd - 1 ? move('d') : move ('u');
            }

            while (col > goalCol) {
                // tile needs to move left, so empty tile needs to be moved to left of tile

                // empty needs to move out the way to get to the left side of the tile
                if (row === emptyRow && emptyCol > col) {
                    // move empty around tile to avoid moving solved tiles

                    // if filling top, try to move around bottom of tile if possible
                    if (goalRow === grid.rowStart) {
                        row === grid.rowEnd - 1 ? move('d') : move('u');
                    } else if (goalRow === grid.rowEnd - 1) {
                        // if filling bottom, try to move around top of tile if possible
                        row === grid.rowStart ? move('u') : move('d');
                    }

                }

                // move empty to col left of tile
                while (emptyCol >= col) move('r');
                while (emptyCol < col - 1) move('l');

                // move empty to row of tile
                while (emptyRow > row) move ('d');
                while (emptyRow < row) move ('u');

                // move tile left
                move('l');
                col--;
            }

            while (col < goalCol) {
                // tile needs to move right, so empty tile needs to be moved to right of tile

                // empty needs to move out the way to get to the right side of the tile
                if (row === emptyRow && emptyCol < col) {
                    // move empty around tile to avoid moving solved tiles

                    // if filling top, try to move around bottom of tile if possible
                    if (goalRow === grid.rowStart) {
                        row === grid.rowEnd - 1 ? move('d') : move('u');
                    } else if (goalRow === grid.rowEnd - 1) {
                        // if filling bottom, try to move around top of tile if possible
                        row === grid.rowStart ? move('u') : move('d');
                    }
                }

                // move empty to right of tile
                while (emptyCol <= col) move('l');
                while (emptyCol > col + 1) move('r');

                // move empty to row of tile
                while (emptyRow > row) move ('d');
                while (emptyRow < row) move ('u');

                // move tile right
                move('r');
                col++;
            }

            // tile now in correct column

            while (row > goalRow) {
                // tile needs to move up, so the empty tile needs to be moved to top of tile

                // can move up normally as long as
                // - not last tile in row
                // - tile is more than 2 tiles below goal
                if (col !== grid.colEnd - 1 || row - 2 > goalRow){
                    // if row is 1 below goal and empty is to the left or below tile
                    // empty must rotate around the bottom of the tile to get to the top
                    // so as not to displace previously placed tiles
                    if (row - 1 === goalRow && emptyCol <= col && emptyRow >= row) {

                        // move emptyRow below row
                        while (emptyRow <= row) move('u');

                        // move emptyCol to right of tile
                        while (emptyCol <= col) move('l');
                    }

                    // NOTE: necessary despite code block above as tile could be against wall

                    // if empty under tile, move to the right if possible
                    // to avoid displacing previously placed tiles
                    if (emptyRow > row && emptyCol === col) {
                        col === grid.colEnd - 1 ? move('r') : move('l');
                    }

                    // move empty row to just above tile
                    while (emptyRow >= row) move('d');
                    while (emptyRow < row - 1) move('u');

                    // move empty col to match tile's
                    while (emptyCol > col) move('r');
                    while (emptyCol < col) move('l');

                    // move tile up
                    move('u');
                    row--;
                }  
                // last tile of row must be rotated in along with previous tile in row
                // because rotating affects tiles on one side of a tile
                // and at the last column, only the left column's tiles can be used for rotation
                else {
                    // tile in last col and row - 2 <= goalRow

                    if (row - 1 === goalRow) {
                        // move directly into goal:
                        // if empty in goalRow, must be directly above tile
                        // as previously tiles already solved
                        if (emptyRow === goalRow) {
                            move('u');
                            return;
                        } else {
                            // move tile down one to give room to maneuver previous tile 
                            // above it

                            // NOTE: empty must be to left and/or below tile
                            // as tile is in rightmost column and 1 space below the top
                            // and empty is not above it

                            // position empty below tile
                            while (emptyRow <= row) move('u');
                            while (emptyCol < col) move('l');

                            // move tile down
                            move('d');
                            row++;
                        }
                    }

                    // tile is in last col and row - 2 === goalRow

                    // move previous tile into current goal

                    // move empty around tile to get up to previous tile
                    if (emptyRow > row && emptyCol === col) move('r');

                    // avoid previously solved tiles while going up and around tile
                    while (emptyRow > goalRow + 1) move('d');
                    while (emptyCol < goalCol) move('l');

                    // move empty to goal position
                    while (emptyRow > goalRow) move('d');

                    // current state:
                    // tile 2 spaces below goal
                    // previous tiles in their goals
                    // empty tile 1 space right of previous tile (current tile's goal position)

                    // rotate last 2 tiles in row into place
                    move('rulurddlu');

                    row = goalRow;
                } 
            }

            while (row < goalRow) {
                // tile needs to move down, so the empty tile needs to be moved to bottom of tile

                if (col !== grid.colEnd - 1 || row + 2 < goalRow){

                    // empty needs to move out of the way to get to the bottom of the tile
                    // as is currently to tile's top/left and needs to move to tile's bottom
                    if (row + 1 === goalRow && emptyCol <= col && emptyRow <= row) {
                        while (emptyRow >= row) move('d');
                        while (emptyCol <= col) move('l');
                    }

                    // move empty around tile if in same column and empty above tile
                    // (different from above, as above only necessary if tile is too
                    // close to goal and not as good a solution when tile is farther away)
                    if (col === emptyCol && emptyRow < row) {
                        col === grid.colEnd - 1 ? move('r') : move('l');
                    }

                    // move empty to bottom of tile
                    while (emptyRow <= row) move('u');
                    while (emptyRow > row + 1) move('d');

                    // move empty to col of tile
                    while (emptyCol > col) move('r');
                    while (emptyCol < col) move('l');

                    // move tile down
                    move('d');
                    row++;  
                } else {
                    // last tile of bottom row needs to be rotated in along with previous tile,
                    // similar to last tile of top row

                    // tile in correct col and either 1 or 2 spaces above goal

                    if (row + 1 === goalRow) {
                        // move tile directly into place
                        if (emptyRow === goalRow) {
                            move('d');
                            return;
                        } else {
                            // move tile up to give room for previous tile to maneuver

                            while (emptyRow >= row) move('d');
                            while (emptyCol < col) move('l');

                            move('u');
                            row--;
                        }
                    }

                    // tile is now 2 spaces above goal

                    // move previous tile into current goal

                    // move empty around tile to get up to previous tile
                    if (emptyRow < row && emptyCol === col) move('r');

                    while (emptyRow < goalRow - 1) move('u');
                    while (emptyCol < goalCol) move('l');

                    // move empty to goal position
                    while (emptyRow < goalRow) move('u');

                    // curent state:
                    // tile 2 spaces above goal
                    // previous tiles in goal
                    // empty tile 1 space right of previous tile (current tile's goal position)

                    // rotate last 2 tiles into place
                    move('rdldruuld');

                    row = goalRow;
                }        
            }
        }

        let emptyGoal = grid.tiles[grid.emptyPos];

        // solves 1 dimensional puzzles
        if (grid.numRows === 1) {
            while (grid.emptyPos < emptyGoal) move('l');
            while (grid.emptyPos > emptyGoal) move('r');
            return moves;
        } else if (grid.numCols === 1) {
            while (grid.emptyPos < emptyGoal) move ('u');
            while (grid.emptyPos > emptyGoal) move('d');
            return moves;
        }

        let emptyGoalRow = grid.getTileRow(emptyGoal);
        let emptyGoalCol = grid.getTileCol(emptyGoal);

        // fill each row left to right, top to bottom until empty tile's row reach
        // or 2 rows remaining
        for (let row = 0; row < Math.min(emptyGoalRow, grid.numRows - 2); row++) {
            let start = grid.numCols * row;

            for (let goal = start; goal < start + grid.numCols; goal++) {
                let ind = grid.goals[goal];

                moveTile(ind, goal);
            }

            grid.rowStart++;
        }

        for (let row = grid.numRows - 1; row > emptyGoalRow + 1; row--) {
            let start = grid.numCols * row;

            for (let goal = start; goal < start + grid.numCols; goal++) {
                let ind = grid.goals[goal];

                moveTile(ind, goal);
            }
            grid.rowEnd--;
        }

        // remaining unsolved puzzle is now 2xN (where N is arbitrary integer)

        console.log(grid.rowStart, grid.rowEnd, grid.colStart, grid.colEnd);
        console.log(moves);

        let emptyColGoal = grid.getTileCol(grid.tiles[grid.emptyPos]);

        // fill in from left to right until empty tile col reached or 2x2 square remaining
        for (let col = 0; col < Math.min(grid.numCols - 2, emptyColGoal); col++) {

            // goal and current indices of top tile of leftmost column
            let topGoal = grid.getIndex(grid.rowStart, grid.colStart);
            let topInd = grid.goals[topGoal];

            // move top tile to its goal
            moveTile(topInd, topGoal);

            // goal and current indices of bottom tile of leftmost column
            let bottomGoal = topGoal + grid.numCols;
            let bottomInd = grid.goals[bottomGoal];

            if (bottomInd === bottomGoal) {
                grid.colStart++;
                continue;
            }

            // current coords of tile that belongs on the bottom of the leftmost column
            let bottomCol = grid.getTileCol(bottomInd);
            let bottomRow = grid.getTileRow(bottomInd);

            // top tile is occupied, so emptyCol must be in bottom left corner
            // if bottom tile is one away, can move directly into goal
            if (emptyCol === grid.colStart && grid.emptyPos + 1 === bottomInd) {
                move('l');
                grid.colStart++;
                continue;
            }

            // Otherwise:
            // tile needs to be rotated in similarly to top and bottom tiles
            // cannot use moveTile() as above, as certain assumptions on
            // fill order no longer hold true

            // move bottom tile to 2 spaces right of its goal

            // first move tile into bottom row

            while (bottomRow < grid.rowEnd - 1) {

                // move into bottom row
                if (emptyRow === grid.rowStart) move('u');

                // move below tile
                while (emptyCol > bottomCol) move('r');
                while (emptyCol < bottomCol) move('l');

                // move tile into bottom row
                move('d');
                bottomRow++;
            }

            // then move tile into correct col

            // tile is more than 2 spaces right from final goal
            while (bottomCol > col + 2) {
                // move empty around tile to get to its left if necessary
                if (emptyRow === bottomRow && emptyCol > bottomCol) move('d');

                while (emptyCol >= bottomCol) move('r');
                if (emptyRow < bottomRow) move('u');
                while (emptyCol < bottomCol) move('l');

                bottomCol--;
            }

            // tile is one right of final goal (1 tile left of intermediate goal)
            while (bottomCol < col + 2) {

                // maneuver empty to right of goal
                if (emptyCol === bottomCol) move('l');
                if (emptyRow === grid.rowStart) move('u');

                // move bottom col one right
                while (emptyCol > bottomCol) move('r');

                bottomCol++;
            }

            // tile is now 2 spaces right of goal

            // need to move top tile one down in preparation for rotating 2 tiles in

            // move around tile to get below top tile if necessary
            if (emptyCol > bottomCol && emptyRow === bottomRow) move('d');
            while (emptyCol >= bottomCol) move('r');

            if (emptyRow === grid.rowStart) move('u');
            while (emptyCol > grid.colStart) move('r');

            // current state:
            // empty tile in bottom goal
            // top tile in top goal
            // bottom tile 2 tiles right of bottom goal

            // rotate both tiles into place
            move('dluldrrul');

            grid.colStart++;
        }

        // // fill in from right to left until 2x2 square remaining
        for (let col = grid.numCols - 1; col > emptyColGoal + 1; col--) {

            // goal and current indices of top tile of leftmost column
            let topGoal = grid.getIndex(grid.rowStart, grid.colEnd - 1);
            let topInd = grid.goals[topGoal];

            // move top tile to its goal
            // NOTE: can't use moveTile as relies on assumptions like:
            // tiles to left in goalRow are filled in and can't be modified
            // modifying moveTile() to work with right-to-left would
            // make the function more confusing

            let topCol = grid.getTileCol(topInd);
            let topRow = grid.getTileRow(topInd);

            // move top tile into correct row
            if (topRow > grid.rowStart) {
                if (emptyRow === grid.rowEnd - 1) move('d');
                while (emptyCol < topCol) move('l');
                while (emptyCol > topCol) move('r');

                move('u');
                topRow--;
            }

            // move top tile into correct col
            while (topCol < grid.colEnd - 1) {
                // move empty around tile to get to right if necessary
                if (emptyCol < topCol && emptyRow === topRow) move('u');

                while (emptyCol <= topCol) move('l');
                while (emptyCol > topCol + 1) move('r');

                if (emptyRow > topRow) move('d');

                move('r');
                topCol++;
            }

            // goal and current indices of bottom tile of leftmost column
            let bottomGoal = topGoal + grid.numCols;
            let bottomInd = grid.goals[bottomGoal];

            if (bottomInd === bottomGoal) {
                grid.colEnd--;
                continue;
            }

            // current coords of tile that belongs on the bottom of the leftmost column
            let bottomCol = grid.getTileCol(bottomInd);
            let bottomRow = grid.getTileRow(bottomInd);

            // top tile is occupied, so emptyCol must be in bottom right corner
            // if bottom tile is one away, can move directly into goal
            if (emptyCol === grid.colEnd - 1 && grid.emptyPos - 1 === bottomInd) {
                move('r');
                grid.colEnd--;
                continue;
            }

            // move bottom tile 2 tiles left of goal in preparation of rotating 2 tiles in

            // first move tile into bottom row

            while (bottomRow < grid.rowEnd - 1) {

                // move into bottom row
                if (emptyRow === grid.rowStart) move('u');

                // move below tile
                while (emptyCol > bottomCol) move('r');
                while (emptyCol < bottomCol) move('l');

                // move tile into bottom row
                move('d');
                bottomRow++;
            }

            // then move tile into correct col

            // tile is more than 2 spaces left from final goal
            while (bottomCol < col - 2) {
                // move empty around tile to get to its right if necessary
                if (emptyRow === bottomRow && emptyCol < bottomCol) move('d');

                while (emptyCol <= bottomCol) move('l');
                if (emptyRow < bottomRow) move('u');
                while (emptyCol > bottomCol) move('r');

                bottomCol++;
            }

            // tile is one left of final goal (1 tile right of intermediate goal)
            while (bottomCol > col - 2) {

                // maneuver empty to right of goal
                if (emptyCol === bottomCol) move('r');
                if (emptyRow === grid.rowStart) move('u');

                // move bottom col one right
                while (emptyCol < bottomCol) move('l');

                bottomCol--;
            }

            // tile is now 2 spaces left of goal

            // need to move top tile one down in preparation for rotating 2 tiles in

            // move around tile to get below top tile if necessary
            if (emptyCol < bottomCol && emptyRow === bottomRow) move('d');
            while (emptyCol <= bottomCol) move('l');

            if (emptyRow === grid.rowStart) move('u');
            while (emptyCol < grid.colEnd - 1) move('l');

            // current state:
            // empty tile in bottom goal
            // top tile in top goal
            // bottom tile 2 tiles left of bottom goal

            // rotate both tiles into place
            move('drurdllur');

            grid.colEnd--;
        }

        // solve remaining 2x2 puzzle

        // Once 2 tiles (including empty) are solved, 
        // remaining 2 must be already solved if puzzle is solvable

        // NOTE: moveTile is only used for top-left and bottom-left tiles
        // as fill-order assumptions mean using it for tiles on the right
        // won't work

        let topLeftGoal = grid.getIndex(grid.rowStart, grid.colStart);
        if (topLeftGoal !== emptyGoal) {
            // solve top-left tile
            moveTile(grid.goals[topLeftGoal], topLeftGoal);

            // if empty needs to move left, its goal is bottom-left tile
            if (emptyCol > emptyGoalCol) {
                if (emptyRow < emptyGoalRow) move('u');
                move('r');
            }
            if (emptyCol < emptyGoalCol) move('l');

            if (emptyRow > emptyGoalRow) move('d');
            if (emptyRow < emptyGoalRow) move('u');
        }

        let bottomLeftGoal = topLeftGoal + grid.numCols;
        if (bottomLeftGoal !== emptyGoal) {
            // solve bottom-left tile
            moveTile(grid.goals[bottomLeftGoal], bottomLeftGoal);

            // if empty needs to move left, its goal is top-left tile
            if (emptyCol > emptyGoalCol) {
                if (emptyRow > emptyGoalRow) move('d');
                move('r');
            }

            if (emptyCol < emptyGoalCol) move('l');

            if (emptyRow > emptyGoalRow) move('d');
            if (emptyRow < emptyGoalRow) move('u');
        }
        
        return moves;
    }

}

class BaseGrid {
    constructor(numRows, numCols, tiles, emptyPos) {
        this.numRows = numRows;
        this.numCols = numCols;
        this.tiles = tiles;
        this.emptyPos = emptyPos;
    }

    getTileCol(ind) {
        return ind % this.numCols;
    }

    getTileRow(ind) {
        return Math.floor(ind / this.numCols);
    }

    getIndex(row, col) {
        return row * this.numCols + col;
    }

    static getReversedMove(move) {
        return REVERSE_MOVE_MAP[move];
    }

    swap(pos1, pos2) {
        [this.tiles[pos1], this.tiles[pos2]] = [this.tiles[pos2], this.tiles[pos1]];
    }

    // returns change in index of tile to be moved after move
    getMoveDelta(move) {
        let moveDeltaMap = {
            'r': 1,
            'l': -1,
            'u': -this.numCols,
            'd': this.numCols
        }
        return moveDeltaMap[move];
    }

    // TODO: consider instead caching movedInd for every move + emptyPos combo O(n)
    // returns index of tile that would be moved by specified move
    getMovedInd(move) {
        return this.emptyPos - this.getMoveDelta(move);
    }

    applyMove(move) {
        let movedInd = this.getMovedInd(move);
        let endInd = this.emptyPos;

        this.swap(endInd, movedInd);
        this.emptyPos = movedInd;
    }
}

// Grid optimized for strategic solver
class StrategicGrid extends BaseGrid{
    constructor(numRows, numCols, tiles, emptyPos) {
        super(numRows, numCols, tiles, emptyPos);

        // maps goal index to current index
        // ex: arr[0] = 2 -> tile with goal index 0 is now at index 2
        this.goals = tiles.length > 256 ?
            new Uint16Array(tiles.length): new Uint8Array(tiles.length);
        this.tiles.forEach((goal, ind) => this.goals[goal] = ind);

        // marks bounds of unsolved grid (start inclusive, end exclusive)
        // NOTE: bounds do NOT affect any tile positions/indices
        // i.e. indices/rows/cols are the same as if no bounds exist
        this.rowStart = 0;
        this.rowEnd = numRows;
        this.colStart = 0;
        this.colEnd = numCols;
        this.colBounds = [0, numCols];
    }

    swap(pos1, pos2) {
        // each goal position now corresponds with the opposite tile's swapped position
        [this.goals[this.tiles[pos1]], this.goals[this.tiles[pos2]]] =
        [pos2, pos1];

        super.swap(pos1, pos2);
    }
}

// TODO: consider moving validMoves to field of Class instead of instance
// (indexed under grid dimensions)

// TODO: consider having both this and graphical grid extend from BaseGrid to reuse move functions
// pros: cleaner, less redundancy
// cons: performance hit as called functions now have to move up prototype chain
// (not a huge problem for strategic solver, but IDA* explores a lot more nodes)

// Grid optimized for A* and IDA*
class Grid {

    constructor(numRows, numCols, tiles, emptyPos, heuristic, traveledDist, heuristicValue = null, 
        lastMove = null, lastGrid = null, validMoves = null) {
        this.numRows = numRows;
        this.numCols = numCols;
        this.tiles = tiles;
        this.emptyPos = emptyPos;

        this.heuristic = heuristic;
        this.traveledDist = traveledDist;
        this.heuristicValue = heuristicValue === null ? heuristic.calculate(this) : heuristicValue;

        this.lastMove = lastMove;
        this.lastGrid = lastGrid;

        // TODO: attach to external obj or pass between grids to avoid recomputing every new grid
        // precomputing values for better performance
        // IDEA: do all precomputing inside Puzzle() to be referenced by Grid
        // (passing along takes up memory)
        this.validMoves = validMoves === null ? this._precomputeValidMoves() : validMoves;
    }

    getTileCol(ind) {
        return ind % this.numCols;
    }

    getTileRow(ind) {
        return Math.floor(ind / this.numCols);
    }

    getIndex(row, col) {
        return row * this.numCols + col;
    }

    // returns change in index of tile to be moved after move
    getMoveDelta(move) {
        let moveDeltaMap = {
            'r': 1,
            'l': -1,
            'u': -this.numCols,
            'd': this.numCols
        }
        return moveDeltaMap[move];
    }

    // TODO: consider instead caching movedInd for every move + emptyPos combo O(n)
    // returns index of tile that would be moved by specified move
    getMovedInd(move) {
        return this.emptyPos - this.getMoveDelta(move);
    }

    static getReversedMove(move) {
        return REVERSE_MOVE_MAP[move];
    }

    getTileDist(tile1, tile2) {
        return Math.abs(this.getTileRow(tile1) - this.getTileRow(tile2)) +
            Math.abs(this.getTileCol(tile1) - this.getTileCol(tile2));
    }

    reconstructPath() {
        let path = [];
        let curr = this;
        while (curr.lastMove !== null) {
            path.unshift(curr.lastMove);
            curr = curr.lastGrid;
        }
        return path;
    }

    /**
     * returns deep copy of grid ignoring lastGrid (null)
     */
    clone() {
        return new Grid(this.numRows, this.numCols, this.tiles.slice(), this.emptyPos, this.heuristic,
            this.traveledDist, this.heuristicValue, this.lastMove, null, this.validMoves);
    }

    /**
     * returns copy of current grid with specified directional move applied to tile moving into empty position
     * also updates all affected Grid fields in new Grid (emptyPos, heuristic/travel distance, etc.)
     * @param move direction to move tile into empty space
     * @return returns copy of current grid with specified move applied to tile into empty position
     */
    cloneAndApplyMove(move) {
        let newGrid = this.clone();

        newGrid.lastGrid = this;
        newGrid.lastMove = move;

        return Grid._applyMoveHelper(move, newGrid);
    }

    // Applies move to grid NOT clone on grid
    // Returns moveRecord object storing old heuristicValue and emptyPos (for use in reverseMove())
    // (useful for IDA* as memory allocation can be avoided)
    // NOTE: separate function instead of consolidation with "clone" param for slightly better performance
    // NOTE: does NOT update lastMove or lastGrid
    applyMove(move) {
        let oldHeuristicValue = this.heuristicValue;
        let oldEmptyPos = this.emptyPos;

        Grid._applyMoveHelper(move, this);

        // TODO; consider changing to typedArray for slightly better performance
        return {heuristicValue: oldHeuristicValue, emptyPos: oldEmptyPos};
    }

    reverseMove(moveRecord) {
        this.traveledDist--;

        this.heuristicValue = moveRecord.heuristicValue;

        this.swap(this.emptyPos, moveRecord.emptyPos);
        this.emptyPos = moveRecord.emptyPos;
    }

    // applies move to specified grid WITHOUT updating lastMove or lastGrid
    static _applyMoveHelper(move, grid) {
        let movedInd = grid.getMovedInd(move);
        let endInd = grid.emptyPos;

        grid.swap(endInd, movedInd);
        grid.emptyPos = movedInd;

        grid.traveledDist++;

        grid.heuristicValue = grid.heuristic.update(grid, movedInd, endInd, move);
        return grid;
    }

    /**
     * WARNING: Does NOT update heuristicValue, lastMove, emptyPos, or lastGrid
     * swaps 2 positions in grid.
     */
    swap(pos1, pos2) {
        [this.tiles[pos1], this.tiles[pos2]] = [this.tiles[pos2], this.tiles[pos1]];
    }

    // precomputes valid moves for each possible emptyPos to give slight performance benefit
    _precomputeValidMoves() {
        let moves;
        let validMoves = [];
        for (let emptyPos = 0; emptyPos < this.tiles.length; emptyPos++) {
            moves = [];

            let row = this.getTileRow(emptyPos);
            let col = this.getTileCol(emptyPos);

            if (row < this.numRows - 1) {
                moves.push('u');
            }
            if (row > 0) {
                moves.push('d');
            }
            if (col < this.numCols - 1) {
                moves.push('l');
            }
            if (col > 0) {
                moves.push('r');
            }

            validMoves[emptyPos] = moves;
        }
        return validMoves;
    }

    /**
     * returns array of valid moves, where 'l' = left, 'r' = right, 'd' = down, and 'u' = up.
     * @returns {Array} array of valid moves, where moves are defined by tiles moving into the empty space in the grid
     */
    getValidMoves() {
        return this.validMoves[this.emptyPos];
    }

    /**
     * Returns whether grid is solved assuming goal is [0, 1, ... tiles.length - 1]
     * @returns {boolean} whether puzzle is solved
     */
    isSolved() {
        if (this.heuristic.isSolved(this.heuristicValue)) return true;

        // accounts for if can't determine if puzzle solved using heuristic value
        return this.tiles.every((goalInd, ind) => goalInd === ind);
    }
}

function testLinearConflictHeuristic() {
    const testCases = [
        [[0,2,1,7,4,5,6,3,8], 0],
        [[0,2,1,5,4,3,6,7,8], 0],
        [[4,3,6,8,0,7,5,2,1], 4],
        [[2,7,0,5,4,3,8,1,6], 2]];

    const ans = [8, 12, 22, 24];

    for (let [ind, testCase] of testCases.entries()) {
        let testGrid = new Grid(3, 3, ...testCase, new LinearConflictHeuristic(3, 3), 0);
        console.assert(testGrid.heuristicValue === ans[ind], 
            `incorrect answer: answer = ${testGrid.heuristicValue}, correct answer = ${ans[ind]}`);
    }
}

// TODO: remove after done testing
// testLinearConflictHeuristic();


export default Puzzle;